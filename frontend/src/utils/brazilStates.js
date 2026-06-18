// Estados brasileiros (UF) com coordenadas da capital — usado no CRUD e no mapa da equipe.
// lat/lon aproximados das capitais (ponto do marcador no mapa).
export const BRAZIL_STATES = [
  { uf: 'AC', name: 'Acre',                lat: -9.97,  lon: -67.81 },
  { uf: 'AL', name: 'Alagoas',             lat: -9.65,  lon: -35.71 },
  { uf: 'AP', name: 'Amapá',               lat: 0.03,   lon: -51.07 },
  { uf: 'AM', name: 'Amazonas',            lat: -3.10,  lon: -60.02 },
  { uf: 'BA', name: 'Bahia',               lat: -12.97, lon: -38.50 },
  { uf: 'CE', name: 'Ceará',               lat: -3.73,  lon: -38.52 },
  { uf: 'DF', name: 'Distrito Federal',    lat: -15.79, lon: -47.88 },
  { uf: 'ES', name: 'Espírito Santo',      lat: -20.32, lon: -40.34 },
  { uf: 'GO', name: 'Goiás',               lat: -16.69, lon: -49.26 },
  { uf: 'MA', name: 'Maranhão',            lat: -2.53,  lon: -44.30 },
  { uf: 'MT', name: 'Mato Grosso',         lat: -15.60, lon: -56.10 },
  { uf: 'MS', name: 'Mato Grosso do Sul',  lat: -20.44, lon: -54.65 },
  { uf: 'MG', name: 'Minas Gerais',        lat: -19.92, lon: -43.94 },
  { uf: 'PA', name: 'Pará',                lat: -1.46,  lon: -48.50 },
  { uf: 'PB', name: 'Paraíba',             lat: -7.12,  lon: -34.86 },
  { uf: 'PR', name: 'Paraná',              lat: -25.43, lon: -49.27 },
  { uf: 'PE', name: 'Pernambuco',          lat: -8.05,  lon: -34.90 },
  { uf: 'PI', name: 'Piauí',               lat: -5.09,  lon: -42.80 },
  { uf: 'RJ', name: 'Rio de Janeiro',      lat: -22.91, lon: -43.20 },
  { uf: 'RN', name: 'Rio Grande do Norte', lat: -5.79,  lon: -35.21 },
  { uf: 'RS', name: 'Rio Grande do Sul',   lat: -30.03, lon: -51.23 },
  { uf: 'RO', name: 'Rondônia',            lat: -8.76,  lon: -63.90 },
  { uf: 'RR', name: 'Roraima',             lat: 2.82,   lon: -60.67 },
  { uf: 'SC', name: 'Santa Catarina',      lat: -27.59, lon: -48.55 },
  { uf: 'SP', name: 'São Paulo',           lat: -23.55, lon: -46.63 },
  { uf: 'SE', name: 'Sergipe',             lat: -10.91, lon: -37.07 },
  { uf: 'TO', name: 'Tocantins',           lat: -10.18, lon: -48.33 },
];

export const STATE_NAME = Object.fromEntries(BRAZIL_STATES.map(s => [s.uf, s.name]));

// Caixa de projeção (bounding box do Brasil, com pequena folga).
export const MAP_BBOX = { lonMin: -74.2, lonMax: -34.0, latMin: -34.2, latMax: 5.7 };

// Projeta lon/lat para coordenadas de tela (viewBox W×H) — projeção equiretangular simples.
export function projectLonLat(lon, lat, W, H, bbox = MAP_BBOX) {
  const x = ((lon - bbox.lonMin) / (bbox.lonMax - bbox.lonMin)) * W;
  const y = ((bbox.latMax - lat) / (bbox.latMax - bbox.latMin)) * H;
  return [x, y];
}

// Contorno aproximado do Brasil (sequência lon/lat no sentido horário a partir do norte).
// Projetado com a MESMA projeção dos marcadores, garantindo que as bolinhas caiam nos lugares certos.
export const BRAZIL_OUTLINE = [
  [-60.0, 5.0], [-59.0, 4.6], [-56.5, 2.0], [-54.0, 2.2], [-51.6, 4.1], [-51.0, 1.8],
  [-50.0, 0.5], [-48.6, -0.9], [-47.0, -1.0], [-44.3, -2.5], [-41.8, -2.9], [-38.5, -3.7],
  [-37.2, -4.9], [-35.2, -5.2], [-34.8, -7.1], [-34.9, -8.1], [-35.5, -9.6], [-36.5, -10.5],
  [-37.1, -11.0], [-38.5, -13.0], [-39.0, -15.8], [-39.7, -18.0], [-40.3, -20.3], [-41.9, -22.0],
  [-43.2, -23.0], [-44.7, -23.4], [-46.6, -24.0], [-48.5, -25.5], [-48.6, -27.0], [-48.6, -28.5],
  [-49.7, -29.3], [-50.7, -30.4], [-52.1, -31.8], [-53.4, -33.7], [-55.6, -31.0], [-56.0, -30.1],
  [-57.6, -30.2], [-56.8, -27.5], [-54.6, -25.6], [-54.3, -24.0], [-54.7, -22.5], [-57.9, -22.1],
  [-57.9, -20.0], [-58.2, -19.5], [-60.2, -16.3], [-60.0, -13.5], [-62.7, -13.0], [-65.3, -11.0],
  [-66.8, -9.9], [-70.0, -9.8], [-72.2, -9.5], [-73.99, -7.5], [-72.9, -7.1], [-70.7, -4.2],
  [-69.4, -1.4], [-69.8, 0.6], [-67.3, 1.9], [-67.1, 2.8], [-64.0, 4.1], [-63.4, 3.9],
  [-62.1, 4.1], [-60.7, 5.2],
];
