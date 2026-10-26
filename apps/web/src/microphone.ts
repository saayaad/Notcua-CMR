export function captureMicrophone(
  options: {
    request?: () => Promise<MediaStream>;
    timeoutMs?: number;
    isActive?: () => boolean;
  } = {},
): Promise<MediaStream> {
  return new Promise((resolve, reject) => {
    let expired = false;
    const timer = setTimeout(() => {
      expired = true;
      reject(
        new Error(
          'O navegador não liberou o microfone. Confira a permissão de microfone deste site e tente novamente.',
        ),
      );
    }, options.timeoutMs ?? 20_000);
    const request = options.request ?? (() => navigator.mediaDevices.getUserMedia({ audio: true }));
    Promise.resolve()
      .then(request)
      .then(
        (stream) => {
          clearTimeout(timer);
          if (expired || options.isActive?.() === false) {
            stream.getTracks().forEach((track) => track.stop());
            reject(new Error('A solicitação de microfone foi encerrada.'));
          } else resolve(stream);
        },
        (error) => {
          clearTimeout(timer);
          const name = error instanceof Error ? error.name : '';
          reject(
            new Error(
              name === 'NotAllowedError'
                ? 'Permita o acesso ao microfone nas configurações deste site e confira a permissão do Windows.'
                : name === 'NotFoundError'
                  ? 'Nenhum microfone foi encontrado. Conecte ou selecione um dispositivo de entrada.'
                  : name === 'NotReadableError'
                    ? 'O microfone está indisponível ou ocupado por outro aplicativo.'
                    : 'Não foi possível acessar o microfone. Confira o dispositivo e as permissões do navegador.',
            ),
          );
        },
      );
  });
}
