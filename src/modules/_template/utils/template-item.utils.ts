/** Example pure helper — utils/ holds logic with no dependency on the repository, service, or HTTP layer. */
export function slugifyTemplateItemName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
