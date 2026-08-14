// Normaliza texto pra busca: minúsculas, sem acento. Usado em toda tela
// que filtra uma lista por texto digitado (ver CLAUDE.md sobre o padrão
// de busca com autocomplete).
export function normalize(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}
