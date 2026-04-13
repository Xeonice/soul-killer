export interface SceneChoice {
  id: string
  text: string
  next?: string
}

export interface SceneData {
  text: string
  choices: SceneChoice[]
  route?: string
  type?: string
  routing?: Array<{ route_id: string; next: string }>
}

export interface EndingData {
  text: string
  type: string
}

export interface TreeData {
  scenes: Record<string, SceneData>
  history: string[]
  currentScene: string
  endings: Record<string, EndingData>
  scriptId: string
  routes: string[]
  gateScenes: string[]
}

export interface Position {
  x: number
  y: number
  depth: number
}

export interface Edge {
  from: string
  to: string
  choiceId?: string
  routeId?: string
  isRouting?: boolean
  chosen: boolean
}

export const COL_W = 260
export const NODE_W = 200
export const GATE_W = 160
export const GATE_CY = 80
export const NODE_CY = 40
export const ROW_H = 120
