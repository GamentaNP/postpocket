/** Single source of truth for all user-facing constants and product config. */
export const APP = {
  name: 'PostPocket',
  fullName: 'PostPocket — Facebook Photo Organizer',
  version: '2.2.0',
  tagline: 'One post. One folder. Every image together.',
  subtitle: 'Local-first image organizer',
  defaultRootFolder: 'PostPocket',
  defaultThumbSize: 320,
  thumbQuality: 0.72,
  inlineThumbs: 8,
  popupWidth: 408,
  docs: {
    privacy: 'PRIVACY.md',
    readme: 'README.md',
  },
} as const

export const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: '⌂' },
  { id: 'collect', label: 'Collect', icon: '⊕' },
  { id: 'library', label: 'Library', icon: '▦' },
  { id: 'queue', label: 'Queue', icon: '⇅' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
  { id: 'about', label: 'About & privacy', icon: 'ⓘ' },
] as const

export const COLLECT_METHODS = [
  { id: 'single', icon: '◎', title: 'Single post', desc: 'Grab every image from the post you are viewing right now.' },
  { id: 'multi', icon: '▤', title: 'Multiple posts', desc: 'Scan all loaded posts and choose which ones to collect.' },
  { id: 'urls', icon: '⌁', title: 'Post URL queue', desc: 'Paste post links and keep them organized in a queue.' },
  { id: 'local', icon: '⇪', title: 'Local files / folder', desc: 'Import images, folders or ZIPs already on your computer.' },
  { id: 'archive', icon: '▣', title: 'Facebook archive', desc: 'Import a folder exported from your own Facebook account.' },
  { id: 'graph', icon: '⌐', title: 'Meta Graph API', desc: 'Load photos from a Graph API endpoint using your browser session.' },
] as const

export const EXPORT_MODES = [
  { value: 'oneZip', label: 'One ZIP — complete collection' },
  { value: 'perPostZip', label: 'Separate ZIP per post' },
  { value: 'folders', label: 'Actual nested folders in Downloads' },
] as const

export const SETTINGS_GROUPS = [
  { id: 'download', label: 'Download settings', hint: 'Destination, formats and limits' },
  { id: 'folder', label: 'Folder settings', hint: 'Naming, structure and organization' },
  { id: 'preview', label: 'Preview settings', hint: 'Inline, side panel, new tab and gallery' },
  { id: 'queue', label: 'Queue settings', hint: 'Concurrency, retry and pause behavior' },
  { id: 'duplicates', label: 'Duplicate settings', hint: 'Skip, rename or review' },
  { id: 'metadata', label: 'Metadata settings', hint: 'Captions, links and dates' },
  { id: 'storage', label: 'Storage settings', hint: 'Library location, usage and backups' },
  { id: 'privacy', label: 'Privacy and permissions', hint: 'Local data, source access and reset' },
  { id: 'appearance', label: 'Appearance', hint: 'Themes, language and layout' },
  { id: 'shortcuts', label: 'Shortcuts', hint: 'Quick actions and navigation' },
  { id: 'about', label: 'About PostPocket', hint: 'Version, help and notices' },
] as const

export const PERMISSIONS = [
  ['Downloads', 'Save images and ZIPs into folders you choose.'],
  ['Storage', 'Remember your preferences on this device.'],
  ['Tabs / activeTab', 'Read the Facebook post currently open in your tab.'],
  ['Host access: facebook.com, fbcdn.net', 'Load images you already have access to.'],
  ['Notifications', 'Optional completion notices.'],
] as const

export const NAMING_TOKENS = ['date', 'year', 'month', 'source', 'type', 'author', 'postid', 'shortid', 'title', 'slug', 'index', 'topic']

export const MESSAGE = {
  PING: 'PP_PING',
  SCAN: 'PP_SCAN',
  GRAPH_LOAD: 'PP_GRAPH_LOAD',
  EXPAND_POST: 'PP_EXPAND_POST',
  OPEN_DASHBOARD: 'PP_OPEN_DASHBOARD',
  OPEN_SIDEPANEL: 'PP_OPEN_SIDEPANEL',
  GET_SETTINGS: 'PP_GET_SETTINGS',
  SET_SETTINGS: 'PP_SET_SETTINGS',
  RESET_SETTINGS: 'PP_RESET_SETTINGS',
  GET_POSTS: 'PP_GET_POSTS',
  PUT_POST: 'PP_PUT_POST',
  DELETE_POST: 'PP_DELETE_POST',
  CLEAR_LIBRARY: 'PP_CLEAR_LIBRARY',
  GET_JOBS: 'PP_GET_JOBS',
  JOB_ACTION: 'PP_JOB_ACTION',
  COLLECT: 'PP_COLLECT',
  EXPORT: 'PP_EXPORT',
  IMPORT_BACKUP: 'PP_IMPORT_BACKUP',
  PROGRESS: 'PP_JOB_UPDATE',
} as const

export const JOB_ACTIONS = {
  pause: 'pause',
  resume: 'resume',
  cancel: 'cancel',
  retryFailed: 'retryFailed',
  remove: 'remove',
} as const
