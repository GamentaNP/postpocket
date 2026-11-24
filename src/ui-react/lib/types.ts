export interface PostImage {
  url: string
  thumb?: string
  alternates?: string[]
  ext?: string
  width?: number
  height?: number
  bytes?: number
  hash?: string
  local?: boolean
  importKey?: string
  name?: string
  saved?: boolean
  video?: boolean
  poster?: string
}

export interface Post {
  id: string
  postId: string
  sourceType: string
  sourceName: string
  author: string
  date: string
  title: string
  text: string
  postUrl: string
  topic?: string
  images: PostImage[]
  selectedImages?: number[]
  favorite?: boolean
  tags?: string[]
  deleted?: boolean
  savedAt?: number
  jobId?: string
  folder?: string
  found?: boolean
  host?: string
  index?: number
  extraCount?: number
  expandHref?: string
}

export interface JobResult {
  index: number
  postId?: string
  ok: boolean
  error?: string
  filename?: string
  sourceUrl?: string
  hash?: string
  bytes?: number
}

export interface Job {
  id: string
  kind: string
  status: string
  posts: Post[]
  settings: Record<string, any>
  results: JobResult[]
  done: number
  total: number
  currentPost?: string
  createdAt: number
  updatedAt: number
  finishedAt?: number
  startedAt?: number
  error?: string
  removed?: boolean
}

export interface Settings {
  destination: string
  rootFolder: string
  formats: string[]
  quantity: string
  quantityValue: number
  dateFilter: string
  folderPreset: string
  folderTemplate: string
  imagePreset: string
  imageTemplate: string
  prefix: string
  organizeBy: string
  existingFiles: string
  imageOrder: string
  saveMetadata: boolean
  metaCaption: boolean
  metaDate: boolean
  metaSourceLink: boolean
  metaPostId: boolean
  metaSidecar: boolean
  metaReadme: boolean
  metaCsv: boolean
  duplicateMode: string
  previewMode: string
  gridSize: string
  concurrency: number
  delayMs: number
  retryCount: number
  pauseOnError: boolean
  theme: string
  storeImages: boolean
  notifications: boolean
  [key: string]: any
}

export interface ApiResponse<T = any> {
  ok: boolean
  data?: T
  error?: string
  job?: Job
  result?: any
  settings?: Settings
}

export type ViewId = 'overview' | 'collect' | 'library' | 'queue' | 'settings' | 'about'
export type UIMode = 'popup' | 'sidepanel' | 'dashboard'
