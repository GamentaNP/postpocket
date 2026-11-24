import { APP } from './config'
import { hashShort, todayISO, uid } from './format'
import type { Job, Post, Settings } from './types'

const TONES = [58, 46, 34, 66, 40, 52]

function demoThumb(index: number, tone?: number): string {
  const g = tone ?? TONES[index % TONES.length]
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(0,0%,${g}%)"/><stop offset="1" stop-color="hsl(0,0%,${Math.max(4, g - 22)}%)"/>` +
    `</linearGradient></defs><rect width="240" height="180" fill="url(#g)"/>` +
    `<circle cx="186" cy="40" r="17" fill="#ffffff" opacity=".8"/>` +
    `<path d="M0 180 L82 105 L140 158 L198 92 L240 132 L240 180Z" fill="#000000" opacity=".55"/>` +
    `<text x="12" y="166" font-family="monospace" font-size="13" fill="#ffffff" opacity=".85">IMG ${index + 1}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const SAMPLE_POSTS = [
  ['Old question set — subjective questions', 'Group', 'Lok Sewa Exam Preparation', 'Suman Shrestha', '2026-11-18', 6, 'GK'],
  ['Nepal History chapter 4 notes', 'Group', 'Lok Sewa Exam Preparation', 'Anita Gurung', '2026-11-16', 4, 'History'],
  ['Current Affairs October 2083', 'Page', 'Study Nepal', 'Editor', '2026-11-10', 8, 'Current Affairs'],
] as const

export function demoPosts(): Post[] {
  return SAMPLE_POSTS.map((d, pi) => {
    const images = Array.from({ length: d[5] }, (_, i) => ({
      url: '',
      thumb: demoThumb(i, TONES[pi]),
      ext: 'jpg',
      width: 1200,
      height: 900,
      bytes: 240000 + i * 12000,
    }))
    return {
      id: `demo_post_${pi}`,
      postId: `52318470991234${pi}`,
      sourceType: d[1],
      sourceName: d[2],
      author: d[3],
      date: d[4],
      title: d[0],
      text: `${d[0]} — useful for revision.`,
      topic: d[6],
      postUrl: `https://www.facebook.com/groups/123456789/posts/52318470991234${pi}/`,
      images,
      favorite: pi === 0,
      tags: pi === 0 ? ['exam', 'gk'] : [],
      deleted: false,
      savedAt: Date.now() - pi * 86400000,
      jobId: 'demo',
      folder: `${APP.defaultRootFolder}/${d[1]}_${d[2]}/${d[4]}_${d[0].slice(0, 20)}`,
    }
  })
}

export function demoJobs(): Job[] {
  return [
    {
      id: 'demo_job_1',
      kind: 'download',
      status: 'done',
      posts: [],
      settings: {},
      results: [],
      done: 18,
      total: 18,
      currentPost: 'Old question set — subjective questions',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ]
}

export function demoScanPost(): Post {
  return {
    found: true,
    id: uid('post'),
    postId: '523184709912347',
    sourceType: 'Group',
    sourceName: 'Lok Sewa Exam Preparation',
    author: 'Suman Shrestha',
    date: todayISO(),
    title: 'Old question set — subjective questions from the 2078 Lok Sewa exam',
    text: 'Old question set — subjective questions with model answers.',
    postUrl: 'https://www.facebook.com/groups/123456789/posts/523184709912347/',
    images: Array.from({ length: 6 }, (_, i) => ({
      url: '',
      thumb: demoThumb(i),
      ext: 'jpg',
      width: 1280,
      height: 960,
    })),
    host: 'www.facebook.com',
  }
}

export function demoSettings(): Settings {
  return {
    destination: 'downloads',
    rootFolder: APP.defaultRootFolder,
    formats: ['jpg', 'png', 'webp', 'gif'],
    quantity: 'all',
    quantityValue: 25,
    dateFilter: 'all',
    folderPreset: 'date-title',
    folderTemplate: '',
    imagePreset: 'date-title',
    imageTemplate: '',
    prefix: '',
    organizeBy: 'none',
    existingFiles: 'uniquify',
    imageOrder: 'original',
    saveMetadata: true,
    metaCaption: true,
    metaDate: true,
    metaSourceLink: true,
    metaPostId: true,
    metaSidecar: true,
    metaReadme: false,
    metaCsv: false,
    duplicateMode: 'skip',
    previewMode: 'newtab',
    gridSize: 'medium',
    concurrency: 1,
    delayMs: 180,
    retryCount: 2,
    pauseOnError: false,
    theme: 'dark',
    storeImages: true,
    notifications: true,
  }
}

export const DEMO_HASH = hashShort(APP.fullName)
