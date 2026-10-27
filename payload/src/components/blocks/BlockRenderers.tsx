import React from 'react'

export interface BlockProps<T = any> {
  blockData: T
  headings?: Array<{ id: string; text: string; level: string }>
}

export const ImageBlockComponent: React.FC<BlockProps> = ({ blockData }) => {
  if (!blockData) return null
  const { image, altText, caption, alignment = 'center', size = 'full', linkUrl, openInNewTab, loading = 'lazy' } = blockData
  const imageUrl = typeof image === 'object' && image?.url ? image.url : (typeof image === 'string' ? image : '/placeholder.jpg')
  const alt = altText || (typeof image === 'object' && image?.alt) || 'Article image'

  const sizeClasses: Record<string, string> = {
    small: 'max-w-xs',
    medium: 'max-w-md',
    large: 'max-w-2xl',
    full: 'w-full',
  }

  const alignClasses: Record<string, string> = {
    left: 'mr-auto text-left',
    center: 'mx-auto text-center',
    right: 'ml-auto text-right',
  }

  const imgContent = (
    <figure className={`my-6 ${sizeClasses[size] || 'w-full'} ${alignClasses[alignment] || 'mx-auto'}`}>
      <img
        src={imageUrl}
        alt={alt}
        loading={loading === 'eager' ? 'eager' : 'lazy'}
        className="rounded-lg shadow-md max-w-full h-auto object-cover inline-block"
      />
      {caption && <figcaption className="mt-2 text-sm text-gray-500 italic">{caption}</figcaption>}
    </figure>
  )

  if (linkUrl) {
    return (
      <a href={linkUrl} target={openInNewTab ? '_blank' : '_self'} rel={openInNewTab ? 'noopener noreferrer' : undefined}>
        {imgContent}
      </a>
    )
  }

  return imgContent
}

export const GalleryBlockComponent: React.FC<BlockProps> = ({ blockData }) => {
  if (!blockData?.images || !Array.isArray(blockData.images)) return null
  const { images, layout = 'grid', columns = 3, aspectRatio = 'auto', enableLightbox, showCaptions, gap = 'medium' } = blockData

  const colClasses: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4',
  }

  const gapClasses: Record<string, string> = {
    small: 'gap-2',
    medium: 'gap-4',
    large: 'gap-6',
  }

  const aspectClasses: Record<string, string> = {
    '1:1': 'aspect-square',
    '4:3': 'aspect-[4/3]',
    '16:9': 'aspect-video',
    auto: '',
  }

  return (
    <div className={`my-8 grid ${colClasses[columns] || 'grid-cols-3'} ${gapClasses[gap] || 'gap-4'}`}>
      {images.map((item: any, idx: number) => {
        const url = typeof item.image === 'object' ? item.image?.url : item.image
        if (!url) return null
        return (
          <figure key={idx} className="group relative overflow-hidden rounded-lg bg-gray-100 shadow">
            <img
              src={url}
              alt={item.altText || `Gallery image ${idx + 1}`}
              className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${aspectClasses[aspectRatio] || ''}`}
            />
            {showCaptions && item.caption && (
              <figcaption className="p-2 text-xs text-gray-600 bg-white/90 backdrop-blur-sm">
                {item.caption}
              </figcaption>
            )}
          </figure>
        )
      })}
    </div>
  )
}

export const TableBlockComponent: React.FC<BlockProps> = ({ blockData }) => {
  if (!blockData?.columns || !Array.isArray(blockData.columns)) return null
  const { caption, headerRow = true, columns, rows = [], striped = true, compact = false, responsiveMode = 'horizontalScroll' } = blockData

  return (
    <div className={`my-6 ${responsiveMode === 'horizontalScroll' ? 'overflow-x-auto' : ''}`}>
      <table className={`w-full text-left border-collapse border border-gray-200 text-sm ${compact ? 'p-1' : 'p-3'}`}>
        {caption && <caption className="py-2 text-sm text-gray-500 font-medium italic">{caption}</caption>}
        {headerRow && (
          <thead className="bg-gray-100 border-b border-gray-200 font-semibold text-gray-700">
            <tr>
              {columns.map((col: any, idx: number) => (
                <th key={idx} className={`p-3 text-${col.alignment || 'left'} border-r border-gray-200`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row: any, rIdx: number) => (
            <tr key={rIdx} className={`border-b border-gray-200 ${striped && rIdx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}`}>
              {columns.map((col: any, cIdx: number) => {
                const cellVal = row.cells?.[cIdx]?.value || row.cells?.[cIdx] || ''
                return (
                  <td key={cIdx} className={`p-3 text-${col.alignment || 'left'} border-r border-gray-200`}>
                    {typeof cellVal === 'string' ? cellVal : JSON.stringify(cellVal)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export const CalloutBlockComponent: React.FC<BlockProps> = ({ blockData }) => {
  if (!blockData) return null
  const { variant = 'info', title, body, dismissible } = blockData

  const variantStyles: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    info: { bg: 'bg-blue-50', border: 'border-blue-500', text: 'text-blue-900', icon: 'ℹ️' },
    success: { bg: 'bg-green-50', border: 'border-green-500', text: 'text-green-900', icon: '✅' },
    warning: { bg: 'bg-yellow-50', border: 'border-yellow-500', text: 'text-yellow-900', icon: '⚠️' },
    error: { bg: 'bg-red-50', border: 'border-red-500', text: 'text-red-900', icon: '🚨' },
    tip: { bg: 'bg-purple-50', border: 'border-purple-500', text: 'text-purple-900', icon: '💡' },
  }

  const style = variantStyles[variant] || variantStyles.info

  return (
    <aside role="note" className={`my-6 p-4 rounded-r-lg border-l-4 shadow-sm ${style.bg} ${style.border} ${style.text}`}>
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none">{style.icon}</span>
        <div className="flex-1">
          {title && <h4 className="font-bold text-base mb-1">{title}</h4>}
          <div className="text-sm leading-relaxed">
            {typeof body === 'string' ? body : JSON.stringify(body?.root?.children?.[0]?.children?.[0]?.text || body)}
          </div>
        </div>
      </div>
    </aside>
  )
}

export const CtaBlockComponent: React.FC<BlockProps> = ({ blockData }) => {
  if (!blockData) return null
  const { eyebrow, title, description, buttonLabel, buttonUrl, secondaryButtonLabel, secondaryButtonUrl, layout = 'centered', theme = 'default', openInNewTab } = blockData

  const themeStyles: Record<string, string> = {
    default: 'bg-indigo-600 text-white',
    subtle: 'bg-gray-100 text-gray-900 border border-gray-200',
    emphasized: 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg',
  }

  return (
    <section className={`my-8 p-8 rounded-xl ${themeStyles[theme] || themeStyles.default} text-${layout === 'centered' ? 'center' : 'left'}`}>
      {eyebrow && <span className="uppercase text-xs tracking-wider font-semibold opacity-80 block mb-2">{eyebrow}</span>}
      <h3 className="text-2xl font-bold mb-3">{title}</h3>
      {description && <div className="text-sm opacity-90 mb-6 max-w-2xl mx-auto">{typeof description === 'string' ? description : 'Take the next step today.'}</div>}
      <div className={`flex flex-wrap gap-4 items-center ${layout === 'centered' ? 'justify-center' : 'justify-start'}`}>
        <a
          href={buttonUrl}
          target={openInNewTab ? '_blank' : '_self'}
          rel={openInNewTab ? 'noopener noreferrer' : undefined}
          className="px-6 py-3 rounded-lg bg-white text-indigo-700 font-semibold shadow hover:bg-gray-100 transition-colors inline-block"
        >
          {buttonLabel}
        </a>
        {secondaryButtonLabel && secondaryButtonUrl && (
          <a
            href={secondaryButtonUrl}
            target={openInNewTab ? '_blank' : '_self'}
            rel={openInNewTab ? 'noopener noreferrer' : undefined}
            className="px-6 py-3 rounded-lg border border-white/50 hover:bg-white/10 font-semibold transition-colors inline-block"
          >
            {secondaryButtonLabel}
          </a>
        )}
      </div>
    </section>
  )
}

export const TableOfContentsComponent: React.FC<BlockProps> = ({ blockData, headings = [] }) => {
  if (!blockData) return null
  const { title = 'Table of Contents', numbered, collapsible } = blockData

  if (!headings || headings.length === 0) return null

  return (
    <nav aria-label="Table of Contents" className="my-6 p-5 bg-gray-50 border border-gray-200 rounded-lg shadow-sm">
      <h3 className="text-lg font-bold text-gray-900 mb-3">{title}</h3>
      <ul className={`space-y-1 text-sm ${numbered ? 'list-decimal pl-5' : 'list-none'}`}>
        {headings.map((h, i) => {
          const indent = h.level === 'h3' ? 'pl-4' : h.level === 'h4' ? 'pl-8' : ''
          return (
            <li key={i} className={indent}>
              <a href={`#${h.id}`} className="text-indigo-600 hover:underline">
                {h.text}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export const VenueCardComponent: React.FC<BlockProps> = ({ blockData }) => {
  if (!blockData) return null
  const { venue, displayMode = 'standard', customHeading, customDescription, showDetailsLink, detailsLinkLabel = 'View Venue' } = blockData

  const venueObj = typeof venue === 'object' ? venue : { sayraVenueId: venue }
  const headline = customHeading || venueObj.editorialTitle || `Venue (${venueObj.sayraVenueId || 'Gaming Center'})`

  return (
    <div className="my-6 p-5 border border-gray-200 rounded-xl bg-white shadow-sm flex flex-col sm:flex-row gap-4 items-center">
      {venueObj.heroMedia?.url && (
        <img src={venueObj.heroMedia.url} alt={headline} className="w-full sm:w-32 h-24 object-cover rounded-lg" />
      )}
      <div className="flex-1">
        <h4 className="text-lg font-bold text-gray-900">{headline}</h4>
        {customDescription && <p className="text-sm text-gray-600 mt-1">{customDescription}</p>}
        {showDetailsLink && (
          <a
            href={`/venues/${venueObj.sayraVenueId}`}
            className="inline-block mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            {detailsLinkLabel} &rarr;
          </a>
        )}
      </div>
    </div>
  )
}

export const MapBlockComponent: React.FC<BlockProps> = ({ blockData }) => {
  if (!blockData) return null
  const { title, description, locationName, address, latitude, longitude, zoom = 15, showDirectionsLink, directionsLabel = 'Get Directions' } = blockData

  const lat = latitude || 35.6892
  const lon = longitude || 51.3890
  const mapsUrl = `https://www.google.com/maps?q=${lat},${lon}`

  return (
    <div className="my-8 p-4 border border-gray-200 rounded-xl bg-gray-50">
      {title && <h4 className="text-lg font-bold mb-1">{title}</h4>}
      {description && <p className="text-sm text-gray-600 mb-3">{description}</p>}
      <div className="relative w-full h-64 bg-gray-200 rounded-lg overflow-hidden flex items-center justify-center">
        <iframe
          title={title || 'Interactive Map'}
          width="100%"
          height="100%"
          frameBorder="0"
          src={`https://maps.google.com/maps?q=${lat},${lon}&z=${zoom}&output=embed`}
          loading="lazy"
        />
      </div>
      {(address || locationName) && (
        <div className="mt-3 flex justify-between items-center text-sm text-gray-700">
          <span>📍 {locationName} {address && `— ${address}`}</span>
          {showDirectionsLink && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-medium hover:underline">
              {directionsLabel}
            </a>
          )}
        </div>
      )}
    </div>
  )
}

export const EventListBlockComponent: React.FC<BlockProps> = ({ blockData }) => {
  if (!blockData) return null
  const { title = 'Upcoming Events', selectedEvents = [], layout = 'cards' } = blockData

  return (
    <div className="my-8">
      {title && <h3 className="text-xl font-bold mb-4">{title}</h3>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.isArray(selectedEvents) && selectedEvents.length > 0 ? (
          selectedEvents.map((ev: any, idx: number) => {
            const eventTitle = typeof ev === 'object' ? ev.title : `Event #${ev}`
            return (
              <div key={idx} className="p-4 border border-gray-200 rounded-lg bg-white shadow-sm">
                <h4 className="font-bold text-gray-900">{eventTitle}</h4>
                {ev.startDateTime && <p className="text-xs text-gray-500 mt-1">📅 {new Date(ev.startDateTime).toLocaleString()}</p>}
              </div>
            )
          })
        ) : (
          <p className="text-sm text-gray-500 italic">No events scheduled at present.</p>
        )}
      </div>
    </div>
  )
}

export const CalendarBlockComponent: React.FC<BlockProps> = ({ blockData }) => {
  if (!blockData) return null
  const { title = 'Event Calendar', emptyStateText = 'No scheduled events found.' } = blockData

  return (
    <div className="my-8 p-6 border border-gray-200 rounded-xl bg-white shadow-sm">
      <h3 className="text-xl font-bold mb-4">{title}</h3>
      <div className="p-4 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300 text-gray-500 text-sm">
        📅 {emptyStateText}
      </div>
    </div>
  )
}

export const BannerBlockComponent: React.FC<BlockProps> = ({ blockData }) => {
  if (!blockData) return null
  const { title, subtitle, linkLabel, linkUrl, variant = 'promotional' } = blockData

  return (
    <div className="my-8 p-8 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-600 text-white shadow-lg">
      <span className="uppercase text-xs font-bold tracking-widest bg-white/20 px-3 py-1 rounded-full mb-3 inline-block">
        {variant}
      </span>
      <h3 className="text-2xl font-extrabold mb-2">{title}</h3>
      {subtitle && <p className="text-sm opacity-90 mb-4">{subtitle}</p>}
      {linkLabel && linkUrl && (
        <a href={linkUrl} className="px-5 py-2.5 bg-white text-gray-900 rounded-lg font-bold text-sm inline-block shadow hover:bg-gray-100">
          {linkLabel}
        </a>
      )}
    </div>
  )
}

export const VideoBlockComponent: React.FC<BlockProps> = ({ blockData }) => {
  if (!blockData) return null
  const { videoUrl, title, caption, showControls = true } = blockData

  return (
    <figure className="my-8">
      {title && <h4 className="font-bold text-base mb-2">{title}</h4>}
      <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
        {videoUrl ? (
          <iframe
            title={title || 'Video Player'}
            src={videoUrl.replace('watch?v=', 'embed/')}
            className="w-full h-full"
            allowFullScreen
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white text-sm">No video source provided</div>
        )}
      </div>
      {caption && <figcaption className="mt-2 text-xs text-gray-500 italic">{caption}</figcaption>}
    </figure>
  )
}

export const FaqBlockComponent: React.FC<BlockProps> = ({ blockData }) => {
  if (!blockData?.items || !Array.isArray(blockData.items)) return null
  const { title = 'Frequently Asked Questions', items } = blockData

  return (
    <section className="my-8">
      {title && <h3 className="text-xl font-bold mb-4">{title}</h3>}
      <div className="space-y-3">
        {items.map((item: any, idx: number) => (
          <details key={idx} className="group border border-gray-200 rounded-lg p-4 bg-white shadow-sm transition-colors">
            <summary className="font-semibold text-gray-900 cursor-pointer list-none flex justify-between items-center">
              <span>{item.question}</span>
              <span className="transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div className="mt-3 text-sm text-gray-600 border-t border-gray-100 pt-3">
              {typeof item.answer === 'string' ? item.answer : 'Answer content'}
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}

export const QuoteBlockComponent: React.FC<BlockProps> = ({ blockData }) => {
  if (!blockData) return null
  const { quote, attribution, attributionRole, style = 'standard' } = blockData

  return (
    <blockquote className="my-8 p-6 border-l-4 border-indigo-600 bg-gray-50 italic rounded-r-lg">
      <p className="text-lg font-medium text-gray-800">
        "{typeof quote === 'string' ? quote : quote?.root?.children?.[0]?.children?.[0]?.text || 'Quote'}"
      </p>
      {attribution && (
        <footer className="mt-3 text-sm not-italic font-semibold text-gray-700">
          — {attribution} {attributionRole && <span className="font-normal text-gray-500">({attributionRole})</span>}
        </footer>
      )}
    </blockquote>
  )
}

export const StatsBlockComponent: React.FC<BlockProps> = ({ blockData }) => {
  if (!blockData?.items || !Array.isArray(blockData.items)) return null
  const { title, items } = blockData

  return (
    <section className="my-8">
      {title && <h3 className="text-xl font-bold mb-4">{title}</h3>}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {items.map((item: any, idx: number) => (
          <div key={idx} className="p-5 border border-gray-200 rounded-xl bg-white shadow-sm text-center">
            <div className="text-3xl font-extrabold text-indigo-600 mb-1">
              {item.value} {item.unit && <span className="text-sm font-normal text-gray-500">{item.unit}</span>}
            </div>
            <div className="text-sm font-semibold text-gray-800">{item.label}</div>
            {item.description && <p className="text-xs text-gray-500 mt-1">{item.description}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}

export const CardGridComponent: React.FC<BlockProps> = ({ blockData }) => {
  if (!blockData?.cards || !Array.isArray(blockData.cards)) return null
  const { title, cards } = blockData

  return (
    <section className="my-8">
      {title && <h3 className="text-xl font-bold mb-4">{title}</h3>}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {cards.map((card: any, idx: number) => (
          <div key={idx} className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-lg text-gray-900 mb-2">{card.title}</h4>
              {card.description && <p className="text-sm text-gray-600 mb-4">{card.description}</p>}
            </div>
            {card.linkUrl && (
              <a href={card.linkUrl} className="text-sm font-medium text-indigo-600 hover:underline">
                {card.linkLabel || 'Learn more'} &rarr;
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

export const ComparisonBlockComponent: React.FC<BlockProps> = ({ blockData }) => {
  if (!blockData?.items || !Array.isArray(blockData.items)) return null
  const { title, items } = blockData

  return (
    <section className="my-8 overflow-x-auto">
      {title && <h3 className="text-xl font-bold mb-4">{title}</h3>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item: any, idx: number) => (
          <div key={idx} className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-xl text-gray-900 mb-1">{item.name}</h4>
              {item.description && <p className="text-xs text-gray-500 mb-4">{item.description}</p>}
              {item.price?.amount && (
                <div className="text-2xl font-bold text-indigo-600 mb-4">
                  {item.price.amount.toLocaleString()} <span className="text-xs font-normal text-gray-500">{item.price.currency}</span>
                </div>
              )}
            </div>
            {item.linkUrl && (
              <a href={item.linkUrl} className="w-full text-center py-2 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 transition">
                {item.linkLabel || 'Choose Option'}
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

export const StepsBlockComponent: React.FC<BlockProps> = ({ blockData }) => {
  if (!blockData?.steps || !Array.isArray(blockData.steps)) return null
  const { title, steps, showStepNumbers = true } = blockData

  return (
    <section className="my-8">
      {title && <h3 className="text-xl font-bold mb-6">{title}</h3>}
      <ol className="space-y-6">
        {steps.map((step: any, idx: number) => (
          <li key={idx} className="flex gap-4 p-4 border border-gray-200 rounded-xl bg-white shadow-sm">
            {showStepNumbers && (
              <span className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-sm">
                {idx + 1}
              </span>
            )}
            <div>
              <h4 className="font-bold text-gray-900 text-base">{step.title}</h4>
              <div className="text-sm text-gray-600 mt-1">
                {typeof step.description === 'string' ? step.description : 'Step description'}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

export const DownloadBlockComponent: React.FC<BlockProps> = ({ blockData }) => {
  if (!blockData) return null
  const { title, description, buttonLabel = 'Download File', file } = blockData
  const fileUrl = typeof file === 'object' ? file?.url : file

  return (
    <div className="my-6 p-5 border border-indigo-100 rounded-xl bg-indigo-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
      <div>
        <h4 className="font-bold text-gray-900 text-base">📁 {title}</h4>
        {description && <p className="text-xs text-gray-600 mt-1">{description}</p>}
      </div>
      {fileUrl && (
        <a href={fileUrl} download className="px-5 py-2.5 bg-indigo-600 text-white font-semibold text-sm rounded-lg hover:bg-indigo-700 transition shrink-0">
          {buttonLabel}
        </a>
      )}
    </div>
  )
}

export const RelatedContentComponent: React.FC<BlockProps> = ({ blockData }) => {
  if (!blockData) return null
  const { title = 'Related Content' } = blockData

  return (
    <section className="my-8 p-6 bg-gray-50 border border-gray-200 rounded-xl">
      <h3 className="text-lg font-bold text-gray-900 mb-3">{title}</h3>
      <p className="text-sm text-gray-500 italic">Recommended reading based on current topic.</p>
    </section>
  )
}

export const ArticleMetadataComponent: React.FC<BlockProps> = ({ blockData }) => {
  if (!blockData) return null
  const { showAuthor, author, showPublishedDate, showReadingTime } = blockData

  return (
    <div className="my-6 py-3 border-y border-gray-200 flex flex-wrap items-center gap-4 text-xs text-gray-500 font-medium">
      {showAuthor && <span>👤 Author: {typeof author === 'object' ? author?.email || author?.name : 'Editorial Staff'}</span>}
      {showPublishedDate && <span>📅 Published recently</span>}
      {showReadingTime && <span>⏱️ 5 min read</span>}
    </div>
  )
}

export const EmbedBlockComponent: React.FC<BlockProps> = ({ blockData }) => {
  if (!blockData) return null
  const { provider, url, title, caption } = blockData

  return (
    <figure className="my-8">
      <div className="aspect-video w-full rounded-xl overflow-hidden bg-gray-900">
        <iframe title={title || `${provider} embed`} src={url} className="w-full h-full" allowFullScreen />
      </div>
      {caption && <figcaption className="mt-2 text-xs text-gray-500 italic text-center">{caption}</figcaption>}
    </figure>
  )
}

export const CodeBlockComponent: React.FC<BlockProps> = ({ blockData }) => {
  if (!blockData) return null
  const { language = 'plaintext', code, title } = blockData

  return (
    <div className="my-6 rounded-xl overflow-hidden bg-gray-900 text-gray-100 font-mono text-xs shadow-md">
      {title && <div className="px-4 py-2 bg-gray-800 text-gray-400 border-b border-gray-700 flex justify-between"><span>{title}</span><span>{language}</span></div>}
      <pre className="p-4 overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}

export const CustomExtensionComponent: React.FC<BlockProps> = ({ blockData }) => {
  if (!blockData) return null
  return (
    <div className="my-6 p-4 border border-dashed border-gray-300 rounded-lg text-xs text-gray-500">
      Extension [{blockData.extensionType}]: {blockData.title || 'Custom Component'}
    </div>
  )
}
