export function projectTitleFromFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, "");
}

export function projectIdentityFromFilename(filename: string): string {
  return projectTitleFromFilename(filename)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
