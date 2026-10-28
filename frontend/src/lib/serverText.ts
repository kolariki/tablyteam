import { getLang } from './i18n'

/**
 * Fixed labels the backend emits in Spanish (the CLI agents' activity feed: "Leyendo", "Escribiendo"…). With the UI in
 * English they are shown in English; anything not in the map passes through unchanged.
 */
const EN: Record<string, string> = {
  Leyendo: 'Reading',
  Escribiendo: 'Writing',
  Editando: 'Editing',
  Ejecutando: 'Running',
  Pensando: 'Thinking',
  'Explorando el proyecto': 'Exploring the project',
  'Actualizando el plan': 'Updating the plan',
  'Instalando dependencias': 'Installing dependencies',
  'Corriendo los tests': 'Running the tests',
  'Compilando y verificando': 'Compiling and checking',
  'Guardando en git': 'Saving to git',
  'Creando la estructura de carpetas': 'Creating the folder structure',
  'Revisando el entorno': 'Checking the environment',
  'Inicializando el proyecto': 'Initializing the project',
  Buscando: 'Searching',
  Analizando: 'Analyzing',
}

export function srv(label: string | null | undefined): string {
  const s = label ?? ''
  if (getLang() !== 'en') return s
  if (EN[s]) return EN[s]
  const m = s.match(/^(Analizando|Entrando a|Buscando)\s+(.+)$/)
  if (m) return `${{ Analizando: 'Analyzing', 'Entrando a': 'Opening', Buscando: 'Searching' }[m[1]]} ${m[2]}`
  return s
}
