import {
  Users,
  MessageSquare,
  Trophy,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  CircleHelp,
} from 'lucide-react';
import type { CrmMetrics } from './crm.types';
import { money } from './crm.types';

export function MetricCards({ metrics }: { metrics: CrmMetrics | null }) {
  const values = [
    {
      name: 'Contatos',
      value: metrics?.contacts.toLocaleString('pt-BR'),
      note: 'Conversas individuais nesta conexão',
      icon: Users,
      color: 'purple',
    },
    {
      name: 'Em atendimento',
      value: metrics?.attendances.toLocaleString('pt-BR'),
      note: `${metrics?.unread ?? 0} ${metrics?.unread === 1 ? 'contato com mensagens não lidas' : 'contatos com mensagens não lidas'}`,
      icon: MessageSquare,
      color: 'blue',
    },
    {
      name: 'Negócios ganhos',
      value: metrics ? money(metrics.wonValueInCents) : undefined,
      note: `${metrics?.won ?? 0} negociações ganhas no período`,
      icon: Trophy,
      color: 'green',
    },
    {
      name: 'Conversão',
      value: metrics
        ? `${metrics.conversion.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
        : undefined,
      note: 'Ganhos ÷ (ganhos + perdidos) no período',
      icon: TrendingUp,
      color: 'amber',
    },
  ];
  return (
    <div className="crm-metrics">
      {values.map(({ name, value, note, icon: Icon, color }) => (
        <article className="crm-metric" key={name}>
          <div>
            <span>{name}</span>
            <i className={`metric-icon ${color}`}>
              <Icon size={19} />
            </i>
          </div>
          <strong>{value ?? '—'}</strong>
          <p>{note}</p>
        </article>
      ))}
    </div>
  );
}

export function CrmDashboard({ metrics }: { metrics: CrmMetrics | null }) {
  if (!metrics) return <p className="muted crm-loading">Carregando indicadores…</p>;
  const maximum = Math.max(1, ...metrics.activity.map((day) => Math.max(day.received, day.sent)));
  return (
    <div className="crm-dashboard">
      <section className="crm-chart">
        <header>
          <div>
            <h2>Conversas que movimentam seu negócio</h2>
            <p>Mensagens recebidas e enviadas nos últimos 7 dias</p>
          </div>
          <div className="chart-legend">
            <span>
              <i />
              Recebidas
            </span>
            <span>
              <i />
              Enviadas
            </span>
          </div>
        </header>
        <div
          className="activity-chart"
          role="img"
          aria-label={metrics.activity
            .map(
              (day) =>
                `${new Date(day.date).toLocaleDateString('pt-BR')}: ${day.received} recebidas, ${day.sent} enviadas`,
            )
            .join('; ')}
        >
          {metrics.activity.map((day) => (
            <div className="activity-day" key={day.date}>
              <div className="activity-bars">
                <div
                  title={`${day.received} recebidas`}
                  style={{ height: `${(day.received / maximum) * 100}%` }}
                >
                  <span>{day.received}</span>
                </div>
                <div title={`${day.sent} enviadas`} style={{ height: `${(day.sent / maximum) * 100}%` }}>
                  <span>{day.sent}</span>
                </div>
              </div>
              <span>
                {new Date(day.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      </section>
      <section className="crm-results">
        <h2>Seu resultado no período</h2>
        <div>
          <i>
            <ArrowDownLeft size={19} />
          </i>
          <span>
            Mensagens recebidas<strong>{metrics.inbound.toLocaleString('pt-BR')}</strong>
          </span>
        </div>
        <div>
          <i>
            <ArrowUpRight size={19} />
          </i>
          <span>
            Mensagens enviadas<strong>{metrics.outbound.toLocaleString('pt-BR')}</strong>
          </span>
        </div>
        <div>
          <i>
            <Users size={19} />
          </i>
          <span>
            Contatos com atividade<strong>{metrics.active.toLocaleString('pt-BR')}</strong>
          </span>
        </div>
        <div>
          <i>
            <Wallet size={19} />
          </i>
          <span>
            Valor em negociação agora<strong>{money(metrics.openValueInCents)}</strong>
          </span>
        </div>
        <p>
          <CircleHelp size={15} />
          Ganhos e perdas são marcados por você nos cartões. Esses valores não confirmam pagamentos bancários.
        </p>
      </section>
      <section className="crm-definition">
        <CircleHelp size={18} />
        <div>
          <strong>Como ler os indicadores</strong>
          <p>
            Contatos e atendimentos mostram o estado atual da conexão, sem grupos. Ganhos, perdas, conversão e
            volume de mensagens respeitam o período selecionado. Uma negociação é contada uma vez, mesmo que o
            contato tenha várias etiquetas. O gráfico sempre mostra os últimos 7 dias.
          </p>
        </div>
      </section>
    </div>
  );
}
