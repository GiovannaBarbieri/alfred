type ExportableChart = {
  element: HTMLElement;
  title: string;
  period: string;
};

const textEncoder = new TextEncoder();

export function getExportableCharts(root: ParentNode = document): ExportableChart[] {
  const analysisResult = root.querySelector<HTMLElement>("[data-period-analysis-result]");
  const source = analysisResult && isVisible(analysisResult) ? analysisResult : root;
  return Array.from(source.querySelectorAll<HTMLElement>("[data-chart-export-card]"))
    .filter((element) => {
      return isVisible(element);
    })
    .map((element) => ({
      element,
      period: element.dataset.chartExportPeriod ?? "",
      title: element.dataset.chartExportTitle ?? "Grafico",
    }));
}

function isVisible(element: HTMLElement) {
  const box = element.getBoundingClientRect();
  return box.width > 0 && box.height > 0;
}

export function getCurrentExportableChart(root: ParentNode = document) {
  const charts = getExportableCharts(root);
  if (charts.length === 0) return null;
  const viewportMiddle = window.innerHeight / 2;
  return charts
    .map((chart) => {
      const box = chart.element.getBoundingClientRect();
      const center = box.top + box.height / 2;
      return { chart, distance: Math.abs(center - viewportMiddle) };
    })
    .sort((left, right) => left.distance - right.distance)[0]?.chart ?? charts[0];
}

export async function exportChartAsPng(chart: ExportableChart) {
  const blob = await captureElementAsPng(chart.element);
  downloadBlob(blob, `${chartFileBaseName(chart)}.png`);
}

export async function exportChartsAsZip(charts: ExportableChart[], reportName: string) {
  const files = await Promise.all(charts.map(async (chart) => ({
    name: `${chartFileBaseName(chart)}.png`,
    data: new Uint8Array(await (await captureElementAsPng(chart.element)).arrayBuffer()),
  })));
  const zip = buildZip(files);
  downloadBlob(zip, `${sanitizeFileName(reportName || "Indicadores Gerais")}.zip`);
}

function chartFileBaseName(chart: ExportableChart) {
  return sanitizeFileName([chart.title, chart.period].filter(Boolean).join(" - "));
}

export function sanitizeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140) || "grafico";
}

async function captureElementAsPng(element: HTMLElement) {
  const box = element.getBoundingClientRect();
  const width = Math.ceil(box.width);
  const height = Math.ceil(box.height);
  const clone = element.cloneNode(true) as HTMLElement;
  if (clone instanceof HTMLDetailsElement) clone.open = true;
  clone.style.margin = "0";
  clone.style.width = `${width}px`;
  clone.style.minWidth = `${width}px`;
  clone.style.maxWidth = `${width}px`;
  clone.style.height = "auto";
  inlineComputedStyles(element, clone);
  clone.querySelectorAll("[data-export-exclude]").forEach((item) => item.remove());

  const wrapper = document.createElement("div");
  wrapper.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  wrapper.style.background = "#ffffff";
  wrapper.style.boxSizing = "border-box";
  wrapper.style.margin = "0";
  wrapper.style.padding = "0";
  wrapper.style.width = `${width}px`;
  wrapper.appendChild(clone);

  const serialized = new XMLSerializer().serializeToString(wrapper);
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<foreignObject width="100%" height="100%">${serialized}</foreignObject>`,
    "</svg>",
  ].join("");
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = await loadImage(url);
    const scale = Math.min(Math.max(window.devicePixelRatio || 2, 2), 3);
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Nao foi possivel preparar a imagem do grafico.");
    context.scale(scale, scale);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return await canvasToBlob(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function inlineComputedStyles(source: Element, target: Element) {
  const computed = window.getComputedStyle(source);
  const targetElement = target as HTMLElement;
  Array.from(computed).forEach((property) => {
    targetElement.style.setProperty(property, computed.getPropertyValue(property), computed.getPropertyPriority(property));
  });
  Array.from(source.children).forEach((sourceChild, index) => {
    const targetChild = target.children.item(index);
    if (targetChild) inlineComputedStyles(sourceChild, targetChild);
  });
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Nao foi possivel gerar a imagem do grafico."));
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Nao foi possivel gerar o PNG do grafico."));
    }, "image/png", 1);
  });
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildZip(files: Array<{ name: string; data: Uint8Array }>) {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  files.forEach((file) => {
    const name = textEncoder.encode(file.name);
    const crc = crc32(file.data);
    const local = concat([
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(crc),
      u32(file.data.length), u32(file.data.length), u16(name.length), u16(0), name, file.data,
    ]);
    localParts.push(local);
    centralParts.push(concat([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(crc),
      u32(file.data.length), u32(file.data.length), u16(name.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), name,
    ]));
    offset += local.length;
  });
  const central = concat(centralParts);
  const end = concat([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(central.length), u32(offset), u16(0),
  ]);
  return new Blob([concat([...localParts, central, end])], { type: "application/zip" });
}

function concat(parts: Uint8Array[]) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });
  return output;
}

function u16(value: number) {
  const output = new Uint8Array(2);
  new DataView(output.buffer).setUint16(0, value, true);
  return output;
}

function u32(value: number) {
  const output = new Uint8Array(4);
  new DataView(output.buffer).setUint32(0, value >>> 0, true);
  return output;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let c = index;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  data.forEach((byte) => {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  });
  return (crc ^ 0xffffffff) >>> 0;
}
