export function uploadErrorMessage(error: unknown, fileBytes: number) {
  const uploadError = error as { status?: number; message?: string };
  if (uploadError?.status !== 413) return error instanceof Error ? error.message : 'Não foi possível concluir o envio.';
  const actualMiB = (fileBytes / 1024 / 1024).toFixed(2);
  const serverMessage = uploadError.message || 'O arquivo ultrapassou o limite do servidor.';
  return `Arquivo escolhido: ${actualMiB} MiB. ${serverMessage}`;
}
