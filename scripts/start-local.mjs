import { connect } from 'node:net';
import { spawn } from 'node:child_process';
const children = [];
const listening = (port) =>
  new Promise((resolve) => {
    const socket = connect({ host: '127.0.0.1', port });
    socket.setTimeout(1500);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    const fail = () => {
      socket.destroy();
      resolve(false);
    };
    socket.once('error', fail);
    socket.once('timeout', fail);
  });
for (const [port, workspace] of [
  [3333, '@noctua/server'],
  [5173, '@noctua/web'],
]) {
  if (await listening(port)) {
    console.log(`Serviço na porta ${port} já está aberto.`);
    continue;
  }
  const child =
    process.platform === 'win32'
      ? spawn(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `npm.cmd run dev -w ${workspace}`], {
          stdio: 'inherit',
          windowsHide: true,
        })
      : spawn('npm', ['run', 'dev', '-w', workspace], { stdio: 'inherit' });
  child.on('error', () => {
    console.error(`Não foi possível iniciar ${workspace}. Confira a instalação do Node.js.`);
    process.exitCode = 1;
  });
  children.push(child);
}
console.log('Abra http://127.0.0.1:5173/atendimento após a inicialização.');
process.on('SIGINT', () => {
  for (const child of children) child.kill('SIGINT');
});
