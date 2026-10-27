import React from 'react'
import {
  ImageBlockComponent,
  GalleryBlockComponent,
  TableBlockComponent,
  CalloutBlockComponent,
  CtaBlockComponent,
  TableOfContentsComponent,
  VenueCardComponent,
  MapBlockComponent,
  EventListBlockComponent,
  CalendarBlockComponent,
  BannerBlockComponent,
  VideoBlockComponent,
  FaqBlockComponent,
  QuoteBlockComponent,
  StatsBlockComponent,
  CardGridComponent,
  ComparisonBlockComponent,
  StepsBlockComponent,
  DownloadBlockComponent,
  RelatedContentComponent,
  ArticleMetadataComponent,
  EmbedBlockComponent,
  CodeBlockComponent,
  CustomExtensionComponent,
} from './blocks/BlockRenderers.js'

export interface HeadingItem {
  id: string
  text: string
  level: string
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'heading'
}

function extractHeadingText(node: any): string {
  if (!node) return ''
  if (node.text) return node.text
  if (node.children && Array.isArray(node.children)) {
    return node.children.map(extractHeadingText).join('')
  }
  return ''
}

export function collectHeadings(children: any[] = []): HeadingItem[] {
  const headings: HeadingItem[] = []
  const seenIds = new Set<string>()

  for (const node of children) {
    if (node?.type === 'heading' && ['h2', 'h3', 'h4'].includes(node?.tag)) {
      const text = extractHeadingText(node)
      if (text) {
        let id = slugify(text)
        let count = 1
        while (seenIds.has(id)) {
          id = `${slugify(text)}-${count++}`
        }
        seenIds.add(id)
        headings.push({ id, text, level: node.tag })
      }
    }
  }
  return headings
}

export interface ArticleRendererProps {
  content: any
  className?: string
}

export const ArticleRenderer: React.FC<ArticleRendererProps> = ({ content, className = '' }) => {
  if (!content || typeof content !== 'object') {
    if (typeof content === 'string') return <div className={className}>{content}</div>
    return null
  }

  const rootChildren = content.root?.children || content.children || []
  const headings = collectHeadings(rootChildren)

  const renderTextNode = (node: any, key: number) => {
    let text: React.ReactNode = node.text || ''
    if (node.format) {
      if (node.format & 1) text = <strong>{text}</strong>
      if (node.format & 2) text = <em>{text}</em>
      if (node.format & 4) text = <s>{text}</s>
      if (node.format & 8) text = <u>{text}</u>
      if (node.format & 16) text = <code className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">{text}</code>
    }
    return <React.Fragment key={key}>{text}</React.Fragment>
  }

  const renderNode = (node: any, idx: number): React.ReactNode => {
    if (!node) return null

    if (node.type === 'text') {
      return renderTextNode(node, idx)
    }

    if (node.type === 'link') {
      const href = node.fields?.url || node.url || '#'
      const target = node.fields?.newTab ? '_blank' : '_self'
      return (
        <a key={idx} href={href} target={target} className="text-indigo-600 hover:underline">
          {node.children?.map((c: any, i: number) => renderNode(c, i))}
        </a>
      )
    }

    if (node.type === 'paragraph') {
      return (
        <p key={idx} className="my-4 text-base leading-relaxed text-gray-800">
          {node.children?.map((c: any, i: number) => renderNode(c, i))}
        </p>
      )
    }

    if (node.type === 'heading') {
      const Tag = (node.tag || 'h2') as 'h2' | 'h3' | 'h4'
      const text = extractHeadingText(node)
      const id = slugify(text)
      const tagClasses: Record<string, string> = {
        h2: 'text-2xl font-bold mt-8 mb-4 text-gray-900 border-b pb-2',
        h3: 'text-xl font-bold mt-6 mb-3 text-gray-900',
        h4: 'text-lg font-semibold mt-4 mb-2 text-gray-900',
      }
      return (
        <Tag key={idx} id={id} className={tagClasses[Tag] || tagClasses.h2}>
          {node.children?.map((c: any, i: number) => renderNode(c, i))}
        </Tag>
      )
    }

    if (node.type === 'list') {
      const ListTag = node.listType === 'number' ? 'ol' : 'ul'
      const listClass = node.listType === 'number' ? 'list-decimal pl-6 my-4 space-y-1' : 'list-disc pl-6 my-4 space-y-1'
      return (
        <ListTag key={idx} className={listClass}>
          {node.children?.map((c: any, i: number) => renderNode(c, i))}
        </ListTag>
      )
    }

    if (node.type === 'listitem') {
      return <li key={idx}>{node.children?.map((c: any, i: number) => renderNode(c, i))}</li>
    }

    if (node.type === 'quote') {
      return (
        <blockquote key={idx} className="my-6 pl-4 border-l-4 border-gray-300 italic text-gray-700">
          {node.children?.map((c: any, i: number) => renderNode(c, i))}
        </blockquote>
      )
    }

    if (node.type === 'block') {
      const fields = node.fields || {}
      const blockType = fields.blockType || fields.blockSlug

      switch (blockType) {
        case 'imageBlock':
          return <ImageBlockComponent key={idx} blockData={fields} />
        case 'galleryBlock':
          return <GalleryBlockComponent key={idx} blockData={fields} />
        case 'tableBlock':
          return <TableBlockComponent key={idx} blockData={fields} />
        case 'calloutBlock':
          return <CalloutBlockComponent key={idx} blockData={fields} />
        case 'ctaBlock':
          return <CtaBlockComponent key={idx} blockData={fields} />
        case 'tableOfContentsBlock':
          return <TableOfContentsComponent key={idx} blockData={fields} headings={headings} />
        case 'venueCardBlock':
          return <VenueCardComponent key={idx} blockData={fields} />
        case 'mapBlock':
          return <MapBlockComponent key={idx} blockData={fields} />
        case 'eventListBlock':
          return <EventListBlockComponent key={idx} blockData={fields} />
        case 'calendarBlock':
          return <CalendarBlockComponent key={idx} blockData={fields} />
        case 'bannerBlock':
          return <BannerBlockComponent key={idx} blockData={fields} />
        case 'videoBlock':
          return <VideoBlockComponent key={idx} blockData={fields} />
        case 'faqBlock':
          return <FaqBlockComponent key={idx} blockData={fields} />
        case 'quoteBlock':
          return <QuoteBlockComponent key={idx} blockData={fields} />
        case 'statsBlock':
          return <StatsBlockComponent key={idx} blockData={fields} />
        case 'cardGridBlock':
          return <CardGridComponent key={idx} blockData={fields} />
        case 'comparisonBlock':
          return <ComparisonBlockComponent key={idx} blockData={fields} />
        case 'stepsBlock':
          return <StepsBlockComponent key={idx} blockData={fields} />
        case 'downloadBlock':
          return <DownloadBlockComponent key={idx} blockData={fields} />
        case 'relatedContentBlock':
          return <RelatedContentComponent key={idx} blockData={fields} />
        case 'articleMetadataBlock':
          return <ArticleMetadataComponent key={idx} blockData={fields} />
        case 'embedBlock':
          return <EmbedBlockComponent key={idx} blockData={fields} />
        case 'codeBlock':
          return <CodeBlockComponent key={idx} blockData={fields} />
        case 'customExtensionBlock':
          return <CustomExtensionComponent key={idx} blockData={fields} />
        default:
          return (
            <div key={idx} className="my-4 p-3 bg-gray-100 rounded text-xs text-gray-500 font-mono">
              Unknown block type: {blockType}
            </div>
          )
      }
    }

    return null
  }

  return (
    <article className={`prose max-w-none ${className}`}>
      {rootChildren.map((childNode: any, idx: number) => renderNode(childNode, idx))}
    </article>
  )
}
