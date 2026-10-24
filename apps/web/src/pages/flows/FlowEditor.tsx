import { useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react';
import { ArrowLeft, Plus, Save, Upload, FlaskConical, Workflow } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import './flows.css';
import type { Label, Library } from '../../types';
import { useApi, errorMessage } from '../../context/ApiContext';
import { FlowInspector } from './FlowInspector';
import { FlowSimulation } from './FlowSimulation';
import { blockNames, type BlockType, type GraphBlock, type FlowDetail, type FlowGraph } from './flow.types';
type CanvasNode = Node<{ block: GraphBlock; subtitle: string }, 'automation'>;
function Block({ data, selected }: NodeProps<CanvasNode>) {
  const block = data.block;
  return (
    <div className={`flow-block block-${block.type} ${selected ? 'selected' : ''}`}>
      {block.type !== 'start' && <Handle type="target" position={Position.Left} id="in" />}
      <small>{blockNames[block.type]}</small>
      <strong>{block.data.title || blockNames[block.type]}</strong>
      <p>{data.subtitle}</p>
      <Handle type="source" position={Position.Right} id="next" />
      {block.type === 'user-input' && (
        <>
          <span className="flow-branch different">Outra resposta</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="different"
            style={{ left: '30%', background: '#e58080' }}
          />
          <span className="flow-branch timeout">Sem resposta</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="timeout"
            style={{ left: '75%', background: '#d7ab60' }}
          />
        </>
      )}
    </div>
  );
}
const nodeTypes = { automation: Block };
const edgeFor = (source: string, target: string, handle = 'next'): Edge => ({
  id: `${source}:${handle}:${target}`,
  source,
  target,
  sourceHandle: handle,
  targetHandle: 'in',
  label: handle === 'different' ? 'Outra resposta' : handle === 'timeout' ? 'Sem resposta' : undefined,
  style: {
    stroke: handle === 'different' ? '#e58080' : handle === 'timeout' ? '#d7ab60' : '#9673e8',
    strokeWidth: 2,
  },
});
function initialEdges(graph: FlowGraph) {
  return graph.nodes.flatMap((node) => [
    ...(node.data.nextNodeIds ?? []).map((target) => edgeFor(node.id, target)),
    ...(node.data.nextNodeIdOnDifferentAnswer
      ? [edgeFor(node.id, node.data.nextNodeIdOnDifferentAnswer, 'different')]
      : []),
    ...((node.data.nextNodeIdOnExpiration ?? node.data.followUpData?.nextNodeIdOnExpiration)
      ? [
          edgeFor(
            node.id,
            (node.data.nextNodeIdOnExpiration ?? node.data.followUpData?.nextNodeIdOnExpiration)!,
            'timeout',
          ),
        ]
      : []),
  ]);
}
export function FlowEditor({
  initial,
  base,
  library,
  onBack,
}: {
  initial: FlowDetail;
  base: string;
  library: Library;
  onBack: () => void;
}) {
  const { request, notify } = useApi();
  const [labels, setLabels] = useState<Label[]>([]);
  useEffect(() => {
    const path = base.split('/flows/')[0]!.replace('/automation/', '/whatsapp/') + '/labels';
    void request<{ items: Label[] }>(path)
      .then((data) => setLabels(data.items))
      .catch((error) => notify(errorMessage(error), true));
  }, [base, request, notify]);
  const [detail, setDetail] = useState(initial);
  const [name, setName] = useState(initial.name);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(initial.graph.nodes[0]?.id ?? '');
  const [simulation, setSimulation] = useState(false);
  const toCanvas = (block: GraphBlock): CanvasNode => ({
    id: block.id,
    type: 'automation',
    position: block.position,
    data: {
      block,
      subtitle:
        block.type === 'start'
          ? (block.data.keywordRules ?? []).map((rule) => rule.keyword).join(' · ') ||
            'Configure uma palavra-chave'
          : block.type === 'delay'
            ? `${(block.data.delayInMs ?? 1000) / 1000} segundos`
            : block.type === 'user-input'
              ? 'Continue conforme a resposta'
              : (library.assets.find((asset) => asset.id === block.data.itemId)?.name ??
                'Selecione um recurso'),
    },
  });
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>(initial.graph.nodes.map(toCanvas));
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges(initial.graph));
  const graph = (): FlowGraph => ({
    nodes: nodes.map((node) => {
      const data = {
        ...node.data.block.data,
        nextNodeIds: edges
          .filter((edge) => edge.source === node.id && edge.sourceHandle === 'next')
          .map((edge) => edge.target),
        nextNodeIdOnDifferentAnswer: edges.find(
          (edge) => edge.source === node.id && edge.sourceHandle === 'different',
        )?.target,
        nextNodeIdOnExpiration: edges.find(
          (edge) => edge.source === node.id && edge.sourceHandle === 'timeout',
        )?.target,
      };
      if (data.followUpData) data.followUpData = { ...data.followUpData, nextNodeIdOnExpiration: undefined };
      if (data.keywordRules) data.keywordRules = data.keywordRules.filter((rule) => rule.keyword.trim());
      if (data.expectedMessages)
        data.expectedMessages = data.expectedMessages.map((value) => value.trim()).filter(Boolean);
      return { ...node.data.block, position: node.position, data };
    }),
  });
  const current = nodes.find((node) => node.id === selected)?.data.block;
  const setTarget = (handle: string, target: string) => {
    setEdges((items) => [
      ...items.filter((edge) => !(edge.source === selected && edge.sourceHandle === handle)),
      ...(target ? [edgeFor(selected, target, handle)] : []),
    ]);
    setDirty(true);
  };
  const save = async () => {
    const result = await request<FlowDetail>(`${base}/draft`, 'PUT', {
      name,
      graph: graph(),
      revision: detail.revision,
    });
    setDetail(result);
    setDirty(false);
    return result;
  };
  const perform = (publish: boolean) => {
    setBusy(true);
    void (async () => {
      const saved = dirty ? await save() : detail;
      if (publish) {
        const result = await request<FlowDetail>(`${base}/publish`, 'POST', { revision: saved.revision });
        setDetail(result);
        notify(
          result.enabled
            ? 'Nova versão publicada para as próximas execuções.'
            : 'Publicado. Ative o fluxo na lista quando estiver pronto.',
        );
      } else notify('Rascunho salvo.');
    })()
      .catch((error) => notify(errorMessage(error), true))
      .finally(() => setBusy(false));
  };
  const addBlock = (type: BlockType) => {
    const id = crypto.randomUUID();
    const block: GraphBlock = {
      id,
      type,
      position: { x: 80 + (nodes.length % 3) * 300, y: 220 + Math.floor(nodes.length / 3) * 200 },
      data: {
        title: blockNames[type],
        nextNodeIds: [],
        simulationDelay: 1000,
        ...(type === 'delay' ? { delayInMs: 5000 } : {}),
        ...(type === 'user-input' ? { compareRule: 'anything', expirationTimeoutInMs: 300000 } : {}),
      },
    };
    setNodes((items) => [...items, toCanvas(block)]);
    setSelected(id);
    setDirty(true);
  };
  return (
    <section className="flow-editor">
      <header className="flow-editor-header">
        <button
          className="icon-button"
          aria-label="Voltar aos fluxos"
          onClick={() => {
            if (!dirty || window.confirm('Sair sem salvar as alterações?')) onBack();
          }}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flow-name">
          <input
            aria-label="Nome do fluxo"
            maxLength={100}
            value={name}
            disabled={busy}
            onChange={(event) => {
              setName(event.target.value);
              setDirty(true);
            }}
          />
          <small>
            {dirty ? 'Alterações não salvas' : 'Rascunho salvo'} ·{' '}
            {detail.publishedVersion ? `Publicação v${detail.publishedVersion}` : 'Ainda não publicado'} ·{' '}
            {detail.enabled ? 'Ativo' : 'Pausado'}
          </small>
        </div>
        <button className="button" disabled={busy} onClick={() => setSimulation(true)}>
          <FlaskConical size={16} />
          Simular
        </button>
        <button className="button" disabled={busy || !dirty} onClick={() => perform(false)}>
          <Save size={16} />
          Salvar
        </button>
        <button className="button primary" disabled={busy || !name.trim()} onClick={() => perform(true)}>
          <Upload size={16} />
          Publicar
        </button>
      </header>
      <div className="flow-palette">
        <span>
          <Workflow size={16} />
          Adicionar bloco
        </span>
        {(['text', 'audio', 'media', 'document', 'delay', 'user-input'] as BlockType[]).map((type) => (
          <button className="button small" key={type} disabled={busy} onClick={() => addBlock(type)}>
            <Plus size={14} />
            {blockNames[type]}
          </button>
        ))}
        <small>Conecte os pontos ou escolha o próximo bloco na configuração.</small>
      </div>
      <div className="flow-editor-body">
        <div className="flow-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={(changes) => {
              onNodesChange(changes);
              if (changes.some((change) => change.type === 'position' || change.type === 'remove'))
                setDirty(true);
            }}
            onEdgesChange={(changes) => {
              onEdgesChange(changes);
              if (changes.some((change) => change.type === 'remove')) setDirty(true);
            }}
            onConnect={(connection) => {
              if (connection.source === connection.target) return;
              const handle = connection.sourceHandle ?? 'next';
              setEdges((items) =>
                addEdge(
                  edgeFor(connection.source, connection.target, handle),
                  handle === 'next'
                    ? items
                    : items.filter(
                        (edge) => edge.source !== connection.source || edge.sourceHandle !== handle,
                      ),
                ),
              );
              setDirty(true);
            }}
            onNodeClick={(_, node) => setSelected(node.id)}
            nodesDraggable={!busy}
            nodesConnectable={!busy}
            elementsSelectable={!busy}
            deleteKeyCode={null}
            fitView
            minZoom={0.3}
            maxZoom={1.5}
          >
            <Background gap={24} color="#79738b33" />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
        {current && (
          <FlowInspector
            labels={labels}
            node={current}
            all={graph().nodes}
            library={library}
            busy={busy}
            close={() => setSelected('')}
            update={(data) => {
              setNodes((items) =>
                items.map((node) =>
                  node.id === selected
                    ? {
                        ...toCanvas({
                          ...node.data.block,
                          data: { ...node.data.block.data, ...data },
                          position: node.position,
                        }),
                        selected: true,
                      }
                    : node,
                ),
              );
              setDirty(true);
            }}
            target={(handle) =>
              edges.find((edge) => edge.source === selected && edge.sourceHandle === handle)?.target ?? ''
            }
            setTarget={setTarget}
            remove={() => {
              setNodes((items) => items.filter((node) => node.id !== selected));
              setEdges((items) =>
                items.filter((edge) => edge.source !== selected && edge.target !== selected),
              );
              setSelected('');
              setDirty(true);
            }}
          />
        )}
      </div>
      {simulation && (
        <FlowSimulation labels={labels} base={base} graph={graph()} onClose={() => setSimulation(false)} />
      )}
    </section>
  );
}
