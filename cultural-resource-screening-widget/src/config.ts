import { type ImmutableObject } from 'seamless-immutable'

export interface ScreeningCheckConfig {
  label: string
  layerTitle: string
  enabled: boolean
}

export interface Config {
  broadbandLayerTitle: string
  checkBroadbandPresence: boolean
  checks: ScreeningCheckConfig[]
}

export type IMConfig = ImmutableObject<Config>
