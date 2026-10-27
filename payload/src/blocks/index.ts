import type { Block } from 'payload'

export const ImageBlock: Block = {
  slug: 'imageBlock',
  labels: { singular: 'Image Block', plural: 'Image Blocks' },
  fields: [
    { name: 'image', type: 'upload', relationTo: 'media', required: true, label: 'Image File' },
    { name: 'altText', type: 'text', required: true, label: 'Alt Text' },
    { name: 'caption', type: 'text', label: 'Caption' },
    {
      name: 'alignment',
      type: 'select',
      defaultValue: 'center',
      options: [
        { label: 'Left', value: 'left' },
        { label: 'Center', value: 'center' },
        { label: 'Right', value: 'right' },
      ],
    },
    {
      name: 'size',
      type: 'select',
      defaultValue: 'full',
      options: [
        { label: 'Small', value: 'small' },
        { label: 'Medium', value: 'medium' },
        { label: 'Large', value: 'large' },
        { label: 'Full Width', value: 'full' },
      ],
    },
    { name: 'linkUrl', type: 'text', label: 'Target Link URL' },
    { name: 'openInNewTab', type: 'checkbox', defaultValue: false, label: 'Open in New Tab' },
    {
      name: 'loading',
      type: 'select',
      defaultValue: 'lazy',
      options: [
        { label: 'Lazy Loading', value: 'lazy' },
        { label: 'Eager Loading', value: 'eager' },
      ],
    },
  ],
}

export const GalleryBlock: Block = {
  slug: 'galleryBlock',
  labels: { singular: 'Image Gallery', plural: 'Image Galleries' },
  fields: [
    {
      name: 'images',
      type: 'array',
      required: true,
      label: 'Gallery Images',
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media', required: true },
        { name: 'altText', type: 'text', required: true },
        { name: 'caption', type: 'text' },
      ],
    },
    {
      name: 'layout',
      type: 'select',
      defaultValue: 'grid',
      options: [
        { label: 'Grid', value: 'grid' },
        { label: 'Masonry', value: 'masonry' },
        { label: 'Carousel', value: 'carousel' },
      ],
    },
    { name: 'columns', type: 'number', defaultValue: 3, label: 'Columns (1-4)' },
    {
      name: 'aspectRatio',
      type: 'select',
      defaultValue: 'auto',
      options: [
        { label: 'Auto', value: 'auto' },
        { label: '1:1 Square', value: '1:1' },
        { label: '4:3 Standard', value: '4:3' },
        { label: '16:9 Widescreen', value: '16:9' },
      ],
    },
    { name: 'enableLightbox', type: 'checkbox', defaultValue: true, label: 'Enable Lightbox' },
    { name: 'showCaptions', type: 'checkbox', defaultValue: true, label: 'Show Captions' },
    {
      name: 'gap',
      type: 'select',
      defaultValue: 'medium',
      options: [
        { label: 'Small', value: 'small' },
        { label: 'Medium', value: 'medium' },
        { label: 'Large', value: 'large' },
      ],
    },
  ],
}

export const TableBlock: Block = {
  slug: 'tableBlock',
  labels: { singular: 'Data Table', plural: 'Data Tables' },
  fields: [
    { name: 'caption', type: 'text', label: 'Table Caption' },
    { name: 'headerRow', type: 'checkbox', defaultValue: true, label: 'Include Header Row' },
    {
      name: 'columns',
      type: 'array',
      required: true,
      label: 'Table Columns',
      fields: [
        { name: 'key', type: 'text', label: 'Column Key' },
        { name: 'label', type: 'text', required: true, label: 'Column Header Label' },
        {
          name: 'alignment',
          type: 'select',
          defaultValue: 'left',
          options: [
            { label: 'Left', value: 'left' },
            { label: 'Center', value: 'center' },
            { label: 'Right', value: 'right' },
          ],
        },
      ],
    },
    {
      name: 'rows',
      type: 'array',
      label: 'Table Rows',
      fields: [
        {
          name: 'cells',
          type: 'array',
          label: 'Cell Values',
          fields: [{ name: 'value', type: 'text', label: 'Cell Content' }],
        },
      ],
    },
    { name: 'striped', type: 'checkbox', defaultValue: true, label: 'Striped Rows' },
    { name: 'compact', type: 'checkbox', defaultValue: false, label: 'Compact Padding' },
    {
      name: 'responsiveMode',
      type: 'select',
      defaultValue: 'horizontalScroll',
      options: [
        { label: 'Horizontal Scroll', value: 'horizontalScroll' },
        { label: 'Stacked Cards', value: 'stacked' },
      ],
    },
  ],
}

export const CalloutBlock: Block = {
  slug: 'calloutBlock',
  labels: { singular: 'Callout Box', plural: 'Callout Boxes' },
  fields: [
    {
      name: 'variant',
      type: 'select',
      defaultValue: 'info',
      required: true,
      options: [
        { label: 'Information', value: 'info' },
        { label: 'Success', value: 'success' },
        { label: 'Warning', value: 'warning' },
        { label: 'Error', value: 'error' },
        { label: 'Tip', value: 'tip' },
      ],
    },
    { name: 'title', type: 'text', label: 'Callout Title' },
    { name: 'body', type: 'richText', required: true, label: 'Callout Body' },
    { name: 'icon', type: 'text', label: 'Custom Icon Identifier' },
    { name: 'dismissible', type: 'checkbox', defaultValue: false, label: 'Dismissible' },
  ],
}

export const CtaBlock: Block = {
  slug: 'ctaBlock',
  labels: { singular: 'Call to Action', plural: 'Calls to Action' },
  fields: [
    { name: 'eyebrow', type: 'text', label: 'Eyebrow Text' },
    { name: 'title', type: 'text', required: true, label: 'CTA Headline' },
    { name: 'description', type: 'richText', label: 'Description Text' },
    { name: 'buttonLabel', type: 'text', required: true, label: 'Primary Button Label' },
    { name: 'buttonUrl', type: 'text', required: true, label: 'Primary Button URL' },
    { name: 'secondaryButtonLabel', type: 'text', label: 'Secondary Button Label' },
    { name: 'secondaryButtonUrl', type: 'text', label: 'Secondary Button URL' },
    { name: 'image', type: 'upload', relationTo: 'media', label: 'Feature Image' },
    {
      name: 'layout',
      type: 'select',
      defaultValue: 'centered',
      options: [
        { label: 'Centered', value: 'centered' },
        { label: 'Horizontal Split', value: 'horizontal' },
        { label: 'Image Left', value: 'imageLeft' },
      ],
    },
    {
      name: 'theme',
      type: 'select',
      defaultValue: 'default',
      options: [
        { label: 'Default', value: 'default' },
        { label: 'Subtle', value: 'subtle' },
        { label: 'Emphasized', value: 'emphasized' },
      ],
    },
    { name: 'openInNewTab', type: 'checkbox', defaultValue: false, label: 'Open Links in New Tab' },
  ],
}

export const TableOfContentsBlock: Block = {
  slug: 'tableOfContentsBlock',
  labels: { singular: 'Table of Contents', plural: 'Tables of Contents' },
  fields: [
    { name: 'title', type: 'text', defaultValue: 'Table of Contents', label: 'TOC Title' },
    {
      name: 'minimumHeadingLevel',
      type: 'select',
      defaultValue: 'h2',
      options: [
        { label: 'H2', value: 'h2' },
        { label: 'H3', value: 'h3' },
        { label: 'H4', value: 'h4' },
      ],
    },
    {
      name: 'maximumHeadingLevel',
      type: 'select',
      defaultValue: 'h3',
      options: [
        { label: 'H2', value: 'h2' },
        { label: 'H3', value: 'h3' },
        { label: 'H4', value: 'h4' },
      ],
    },
    { name: 'includeNestedHeadings', type: 'checkbox', defaultValue: true, label: 'Include Nested Headings' },
    { name: 'collapsible', type: 'checkbox', defaultValue: false, label: 'Collapsible Container' },
    { name: 'initiallyCollapsed', type: 'checkbox', defaultValue: false, label: 'Initially Collapsed' },
    { name: 'numbered', type: 'checkbox', defaultValue: false, label: 'Numbered List' },
    {
      name: 'position',
      type: 'select',
      defaultValue: 'inline',
      options: [
        { label: 'Inline Content', value: 'inline' },
        { label: 'Sidebar Sticky', value: 'sidebar' },
      ],
    },
  ],
}

export const VenueCardBlock: Block = {
  slug: 'venueCardBlock',
  labels: { singular: 'Gaming Venue Card', plural: 'Gaming Venue Cards' },
  fields: [
    { name: 'venue', type: 'relationship', relationTo: 'venue-profiles', required: true, label: 'Select Venue' },
    {
      name: 'displayMode',
      type: 'select',
      defaultValue: 'standard',
      options: [
        { label: 'Compact', value: 'compact' },
        { label: 'Standard', value: 'standard' },
        { label: 'Detailed', value: 'detailed' },
      ],
    },
    { name: 'showImage', type: 'checkbox', defaultValue: true, label: 'Show Cover Image' },
    { name: 'showAddress', type: 'checkbox', defaultValue: true, label: 'Show Address' },
    { name: 'showRating', type: 'checkbox', defaultValue: true, label: 'Show Rating' },
    { name: 'showOpeningHours', type: 'checkbox', defaultValue: true, label: 'Show Opening Hours' },
    { name: 'showAmenities', type: 'checkbox', defaultValue: true, label: 'Show Amenities' },
    { name: 'customHeading', type: 'text', label: 'Custom Heading Override' },
    { name: 'customDescription', type: 'text', label: 'Custom Description Override' },
    { name: 'showDetailsLink', type: 'checkbox', defaultValue: true, label: 'Show Venue Details Link' },
    { name: 'detailsLinkLabel', type: 'text', defaultValue: 'View Gaming Center', label: 'Details Link Text' },
  ],
}

export const MapBlock: Block = {
  slug: 'mapBlock',
  labels: { singular: 'Location & Map', plural: 'Locations & Maps' },
  fields: [
    { name: 'title', type: 'text', label: 'Map Block Title' },
    { name: 'description', type: 'text', label: 'Description' },
    {
      name: 'locationSource',
      type: 'select',
      defaultValue: 'manualLocation',
      options: [
        { label: 'From Venue Reference', value: 'venueReference' },
        { label: 'Manual Coordinates / Address', value: 'manualLocation' },
      ],
    },
    { name: 'venue', type: 'relationship', relationTo: 'venue-profiles', label: 'Associated Venue' },
    { name: 'locationName', type: 'text', label: 'Location Name' },
    { name: 'address', type: 'text', label: 'Full Address' },
    {
      name: 'latitude',
      type: 'number',
      label: 'Latitude (-90 to 90)',
      validate: (val: any) => {
        if (val !== undefined && val !== null && val !== '') {
          const num = Number(val)
          if (isNaN(num) || num < -90 || num > 90) return 'Latitude must be between -90 and 90'
        }
        return true
      },
    },
    {
      name: 'longitude',
      type: 'number',
      label: 'Longitude (-180 to 180)',
      validate: (val: any) => {
        if (val !== undefined && val !== null && val !== '') {
          const num = Number(val)
          if (isNaN(num) || num < -180 || num > 180) return 'Longitude must be between -180 and 180'
        }
        return true
      },
    },
    { name: 'zoom', type: 'number', defaultValue: 15, label: 'Map Zoom Level (1-20)' },
    { name: 'mapHeight', type: 'number', defaultValue: 400, label: 'Map Height (px)' },
    { name: 'showMarker', type: 'checkbox', defaultValue: true, label: 'Show Location Marker' },
    { name: 'showDirectionsLink', type: 'checkbox', defaultValue: true, label: 'Show Directions Link' },
    { name: 'directionsLabel', type: 'text', defaultValue: 'Get Directions', label: 'Directions Button Label' },
    {
      name: 'mapProvider',
      type: 'select',
      defaultValue: 'openstreetmap',
      options: [
        { label: 'OpenStreetMap', value: 'openstreetmap' },
        { label: 'Google Maps', value: 'googlemaps' },
        { label: 'Mapbox', value: 'mapbox' },
      ],
    },
  ],
}

export const EventListBlock: Block = {
  slug: 'eventListBlock',
  labels: { singular: 'Event List', plural: 'Event Lists' },
  fields: [
    { name: 'title', type: 'text', label: 'Section Title' },
    {
      name: 'sourceMode',
      type: 'select',
      defaultValue: 'query',
      options: [
        { label: 'Selected Events', value: 'selectedEvents' },
        { label: 'Dynamic Filter Query', value: 'query' },
      ],
    },
    { name: 'selectedEvents', type: 'relationship', relationTo: 'events', hasMany: true, label: 'Pick Specific Events' },
    { name: 'category', type: 'text', label: 'Category Filter' },
    { name: 'venue', type: 'relationship', relationTo: 'venue-profiles', label: 'Filter by Venue' },
    { name: 'startDate', type: 'date', label: 'Start Date Filter' },
    { name: 'endDate', type: 'date', label: 'End Date Filter' },
    { name: 'includePastEvents', type: 'checkbox', defaultValue: false, label: 'Include Past Events' },
    { name: 'limit', type: 'number', defaultValue: 6, label: 'Maximum Events Count' },
    {
      name: 'sortBy',
      type: 'select',
      defaultValue: 'startDateAscending',
      options: [
        { label: 'Start Date (Ascending)', value: 'startDateAscending' },
        { label: 'Start Date (Descending)', value: 'startDateDescending' },
      ],
    },
    {
      name: 'layout',
      type: 'select',
      defaultValue: 'cards',
      options: [
        { label: 'Cards Grid', value: 'cards' },
        { label: 'List View', value: 'list' },
        { label: 'Compact Rows', value: 'compact' },
      ],
    },
    { name: 'showImages', type: 'checkbox', defaultValue: true, label: 'Show Event Images' },
    { name: 'showVenue', type: 'checkbox', defaultValue: true, label: 'Show Venue Name' },
    { name: 'showRegistrationButton', type: 'checkbox', defaultValue: true, label: 'Show Registration Button' },
  ],
}

export const CalendarBlock: Block = {
  slug: 'calendarBlock',
  labels: { singular: 'Event Calendar', plural: 'Event Calendars' },
  fields: [
    { name: 'title', type: 'text', label: 'Calendar Title' },
    {
      name: 'sourceMode',
      type: 'select',
      defaultValue: 'query',
      options: [
        { label: 'Selected Events', value: 'selectedEvents' },
        { label: 'Dynamic Query', value: 'query' },
      ],
    },
    { name: 'selectedEvents', type: 'relationship', relationTo: 'events', hasMany: true, label: 'Select Events' },
    { name: 'venue', type: 'relationship', relationTo: 'venue-profiles', label: 'Filter by Venue' },
    { name: 'startDate', type: 'date', label: 'Initial Calendar View Date' },
    {
      name: 'viewMode',
      type: 'select',
      defaultValue: 'month',
      options: [
        { label: 'Month View', value: 'month' },
        { label: 'Week View', value: 'week' },
        { label: 'List View', value: 'list' },
      ],
    },
    { name: 'allowViewSwitching', type: 'checkbox', defaultValue: true, label: 'Allow View Mode Switching' },
    { name: 'showPastEvents', type: 'checkbox', defaultValue: false, label: 'Show Past Events' },
    { name: 'showVenue', type: 'checkbox', defaultValue: true, label: 'Show Venue Information' },
    { name: 'showEventImages', type: 'checkbox', defaultValue: true, label: 'Show Event Images' },
    { name: 'showRegistrationLinks', type: 'checkbox', defaultValue: true, label: 'Show Registration Buttons' },
    { name: 'timezone', type: 'text', defaultValue: 'Asia/Tehran', label: 'Display Timezone' },
    { name: 'emptyStateText', type: 'text', defaultValue: 'No scheduled events found.', label: 'Empty State Message' },
  ],
}

export const BannerBlock: Block = {
  slug: 'bannerBlock',
  labels: { singular: 'Promotional Banner', plural: 'Promotional Banners' },
  fields: [
    { name: 'title', type: 'text', required: true, label: 'Banner Title' },
    { name: 'subtitle', type: 'text', label: 'Subtitle Text' },
    { name: 'image', type: 'upload', relationTo: 'media', label: 'Desktop Banner Image' },
    { name: 'mobileImage', type: 'upload', relationTo: 'media', label: 'Mobile Banner Image' },
    { name: 'linkLabel', type: 'text', label: 'Call to Action Label' },
    { name: 'linkUrl', type: 'text', label: 'Call to Action URL' },
    { name: 'startAt', type: 'date', label: 'Display Start Date' },
    { name: 'endAt', type: 'date', label: 'Display End Date' },
    {
      name: 'variant',
      type: 'select',
      defaultValue: 'promotional',
      options: [
        { label: 'Standard Banner', value: 'standard' },
        { label: 'Promotional Campaign', value: 'promotional' },
        { label: 'Event Highlight', value: 'event' },
      ],
    },
    {
      name: 'alignment',
      type: 'select',
      defaultValue: 'center',
      options: [
        { label: 'Left', value: 'left' },
        { label: 'Center', value: 'center' },
        { label: 'Right', value: 'right' },
      ],
    },
    { name: 'overlay', type: 'checkbox', defaultValue: true, label: 'Dark Image Overlay' },
    { name: 'openInNewTab', type: 'checkbox', defaultValue: false, label: 'Open Link in New Tab' },
  ],
}

export const VideoBlock: Block = {
  slug: 'videoBlock',
  labels: { singular: 'Video Embed / Player', plural: 'Video Embeds / Players' },
  fields: [
    {
      name: 'sourceType',
      type: 'select',
      defaultValue: 'external',
      options: [
        { label: 'External Provider (YouTube / Vimeo / Aparat)', value: 'external' },
        { label: 'Uploaded Media Asset', value: 'uploaded' },
      ],
    },
    { name: 'videoUrl', type: 'text', label: 'External Video URL' },
    { name: 'videoFile', type: 'upload', relationTo: 'media', label: 'Uploaded Video Asset' },
    { name: 'posterImage', type: 'upload', relationTo: 'media', label: 'Video Poster / Cover Image' },
    { name: 'title', type: 'text', label: 'Video Title' },
    { name: 'caption', type: 'text', label: 'Video Caption' },
    { name: 'transcript', type: 'richText', label: 'Video Transcript / Closed Captions' },
    {
      name: 'aspectRatio',
      type: 'select',
      defaultValue: '16:9',
      options: [
        { label: '16:9 Widescreen', value: '16:9' },
        { label: '4:3 Standard', value: '4:3' },
        { label: '1:1 Square', value: '1:1' },
      ],
    },
    { name: 'startTime', type: 'number', defaultValue: 0, label: 'Start Time (seconds)' },
    { name: 'showControls', type: 'checkbox', defaultValue: true, label: 'Show Player Controls' },
  ],
}

export const FaqBlock: Block = {
  slug: 'faqBlock',
  labels: { singular: 'FAQ / Accordion', plural: 'FAQ Accordions' },
  fields: [
    { name: 'title', type: 'text', label: 'FAQ Section Title' },
    {
      name: 'items',
      type: 'array',
      required: true,
      label: 'FAQ Items',
      fields: [
        { name: 'question', type: 'text', required: true, label: 'Question' },
        { name: 'answer', type: 'richText', required: true, label: 'Answer Content' },
        { name: 'initiallyExpanded', type: 'checkbox', defaultValue: false, label: 'Expand by Default' },
      ],
    },
    { name: 'allowMultipleOpen', type: 'checkbox', defaultValue: true, label: 'Allow Multiple Open Accordions' },
    { name: 'defaultExpandedFirstItem', type: 'checkbox', defaultValue: false, label: 'Expand First Item Initially' },
  ],
}

export const QuoteBlock: Block = {
  slug: 'quoteBlock',
  labels: { singular: 'Quote Block', plural: 'Quote Blocks' },
  fields: [
    { name: 'quote', type: 'richText', required: true, label: 'Quote Content' },
    { name: 'attribution', type: 'text', label: 'Author / Speaker Name' },
    { name: 'attributionRole', type: 'text', label: 'Role / Title / Company' },
    { name: 'sourceUrl', type: 'text', label: 'Source Reference URL' },
    {
      name: 'style',
      type: 'select',
      defaultValue: 'standard',
      options: [
        { label: 'Standard Quote', value: 'standard' },
        { label: 'Large Featured Quote', value: 'large' },
        { label: 'Bordered Box', value: 'bordered' },
      ],
    },
  ],
}

export const StatsBlock: Block = {
  slug: 'statsBlock',
  labels: { singular: 'Statistics / Metrics', plural: 'Statistics / Metrics' },
  fields: [
    { name: 'title', type: 'text', label: 'Section Title' },
    {
      name: 'items',
      type: 'array',
      required: true,
      label: 'Metric Items',
      fields: [
        { name: 'label', type: 'text', required: true, label: 'Metric Label' },
        { name: 'value', type: 'text', required: true, label: 'Metric Value (e.g. 500+, 99.9%)' },
        { name: 'unit', type: 'text', label: 'Unit Identifier' },
        { name: 'description', type: 'text', label: 'Short Description' },
        { name: 'icon', type: 'text', label: 'Icon Identifier' },
        { name: 'sourceUrl', type: 'text', label: 'Source Verification Link' },
      ],
    },
    { name: 'columns', type: 'number', defaultValue: 3, label: 'Columns Count (1-4)' },
    {
      name: 'layout',
      type: 'select',
      defaultValue: 'cards',
      options: [
        { label: 'Cards Grid', value: 'cards' },
        { label: 'Inline Row', value: 'inline' },
      ],
    },
  ],
}

export const CardGridBlock: Block = {
  slug: 'cardGridBlock',
  labels: { singular: 'Multi-Card Grid', plural: 'Multi-Card Grids' },
  fields: [
    { name: 'title', type: 'text', label: 'Grid Title' },
    { name: 'description', type: 'text', label: 'Grid Description' },
    { name: 'columns', type: 'number', defaultValue: 3, label: 'Columns (1-4)' },
    {
      name: 'cards',
      type: 'array',
      required: true,
      label: 'Cards',
      fields: [
        { name: 'title', type: 'text', required: true, label: 'Card Title' },
        { name: 'description', type: 'text', label: 'Description' },
        { name: 'image', type: 'upload', relationTo: 'media', label: 'Card Image' },
        { name: 'altText', type: 'text', label: 'Image Alt Text' },
        { name: 'linkLabel', type: 'text', label: 'Link Button Label' },
        { name: 'linkUrl', type: 'text', label: 'Target Link URL' },
        { name: 'badge', type: 'text', label: 'Badge Text' },
        {
          name: 'variant',
          type: 'select',
          defaultValue: 'standard',
          options: [
            { label: 'Standard Vertical', value: 'standard' },
            { label: 'Horizontal Layout', value: 'horizontal' },
            { label: 'Compact Tile', value: 'compact' },
          ],
        },
      ],
    },
    { name: 'equalHeight', type: 'checkbox', defaultValue: true, label: 'Equal Height Cards' },
    {
      name: 'imageAspectRatio',
      type: 'select',
      defaultValue: '16:9',
      options: [
        { label: '16:9 Widescreen', value: '16:9' },
        { label: '4:3 Standard', value: '4:3' },
        { label: '1:1 Square', value: '1:1' },
        { label: 'Auto Aspect Ratio', value: 'auto' },
      ],
    },
    { name: 'openLinksInNewTab', type: 'checkbox', defaultValue: false, label: 'Open Card Links in New Tab' },
  ],
}

export const ComparisonBlock: Block = {
  slug: 'comparisonBlock',
  labels: { singular: 'Comparison Table', plural: 'Comparison Tables' },
  fields: [
    { name: 'title', type: 'text', label: 'Comparison Title' },
    {
      name: 'items',
      type: 'array',
      required: true,
      label: 'Compared Products / Venues / Services',
      fields: [
        { name: 'name', type: 'text', required: true, label: 'Item Name' },
        { name: 'description', type: 'text', label: 'Description' },
        { name: 'image', type: 'upload', relationTo: 'media', label: 'Product Image' },
        {
          name: 'price',
          type: 'group',
          label: 'Price',
          fields: [
            { name: 'amount', type: 'number', label: 'Price Amount' },
            { name: 'currency', type: 'text', defaultValue: 'IRT', label: 'Currency' },
          ],
        },
        {
          name: 'features',
          type: 'array',
          label: 'Feature Specs',
          fields: [
            { name: 'label', type: 'text', label: 'Feature Name' },
            { name: 'value', type: 'text', label: 'Spec / Status Value' },
          ],
        },
        { name: 'linkLabel', type: 'text', label: 'Action Button Label' },
        { name: 'linkUrl', type: 'text', label: 'Action URL' },
      ],
    },
    {
      name: 'comparisonMode',
      type: 'select',
      defaultValue: 'table',
      options: [
        { label: 'Comparison Table', value: 'table' },
        { label: 'Side-by-Side Cards', value: 'cards' },
      ],
    },
    { name: 'highlightedItem', type: 'text', label: 'Highlighted Item Name (e.g. Recommended Choice)' },
    { name: 'showPrices', type: 'checkbox', defaultValue: true, label: 'Display Prices' },
    { name: 'showFeatureComparison', type: 'checkbox', defaultValue: true, label: 'Display Feature Rows' },
  ],
}

export const StepsBlock: Block = {
  slug: 'stepsBlock',
  labels: { singular: 'Step-by-Step Guide', plural: 'Step-by-Step Guides' },
  fields: [
    { name: 'title', type: 'text', label: 'Guide Title' },
    { name: 'intro', type: 'text', label: 'Introductory Overview' },
    {
      name: 'steps',
      type: 'array',
      required: true,
      label: 'Guide Steps',
      fields: [
        { name: 'title', type: 'text', required: true, label: 'Step Title' },
        { name: 'description', type: 'richText', required: true, label: 'Step Instructions' },
        { name: 'image', type: 'upload', relationTo: 'media', label: 'Step Illustration Image' },
        { name: 'tip', type: 'text', label: 'Pro Tip / Note' },
        { name: 'duration', type: 'text', label: 'Estimated Time (e.g. 5 mins)' },
      ],
    },
    {
      name: 'layout',
      type: 'select',
      defaultValue: 'numbered',
      options: [
        { label: 'Numbered Steps', value: 'numbered' },
        { label: 'Vertical Timeline', value: 'timeline' },
        { label: 'Step Cards', value: 'cards' },
      ],
    },
    { name: 'showStepNumbers', type: 'checkbox', defaultValue: true, label: 'Show Step Numbers' },
    { name: 'showProgressIndicator', type: 'checkbox', defaultValue: false, label: 'Show Progress Bar' },
  ],
}

export const DownloadBlock: Block = {
  slug: 'downloadBlock',
  labels: { singular: 'Downloadable File', plural: 'Downloadable Files' },
  fields: [
    { name: 'title', type: 'text', required: true, label: 'Resource Title' },
    { name: 'description', type: 'text', label: 'Resource Description' },
    { name: 'file', type: 'upload', relationTo: 'media', required: true, label: 'Target File Asset' },
    { name: 'buttonLabel', type: 'text', defaultValue: 'Download Resource', label: 'Button Text' },
    { name: 'fileType', type: 'text', label: 'File Type Label (e.g. PDF, ZIP)' },
    { name: 'fileSize', type: 'number', label: 'File Size in KB' },
    { name: 'openInNewTab', type: 'checkbox', defaultValue: true, label: 'Open Download in New Window' },
    { name: 'requireAuthentication', type: 'checkbox', defaultValue: false, label: 'Require Login to Download' },
  ],
}

export const RelatedContentBlock: Block = {
  slug: 'relatedContentBlock',
  labels: { singular: 'Related Content', plural: 'Related Content Sections' },
  fields: [
    { name: 'title', type: 'text', defaultValue: 'Related Articles & Venues', label: 'Section Title' },
    {
      name: 'sourceType',
      type: 'select',
      defaultValue: 'articles',
      options: [
        { label: 'Related Articles', value: 'articles' },
        { label: 'Upcoming Events', value: 'events' },
        { label: 'Featured Venues', value: 'venues' },
      ],
    },
    {
      name: 'selectionMode',
      type: 'select',
      defaultValue: 'automatic',
      options: [
        { label: 'Manual Selection', value: 'manual' },
        { label: 'Automatic Selection', value: 'automatic' },
      ],
    },
    { name: 'selectedArticles', type: 'relationship', relationTo: 'articles', hasMany: true, label: 'Selected Articles' },
    { name: 'selectedEvents', type: 'relationship', relationTo: 'events', hasMany: true, label: 'Selected Events' },
    { name: 'selectedVenues', type: 'relationship', relationTo: 'venue-profiles', hasMany: true, label: 'Selected Venues' },
    { name: 'limit', type: 'number', defaultValue: 3, label: 'Maximum Items Displayed' },
    {
      name: 'layout',
      type: 'select',
      defaultValue: 'cards',
      options: [
        { label: 'Cards Grid', value: 'cards' },
        { label: 'List View', value: 'list' },
        { label: 'Grid Tiles', value: 'grid' },
      ],
    },
    { name: 'showImages', type: 'checkbox', defaultValue: true, label: 'Show Cover Images' },
    { name: 'showDescriptions', type: 'checkbox', defaultValue: true, label: 'Show Descriptions' },
    { name: 'showLinks', type: 'checkbox', defaultValue: true, label: 'Show Action Links' },
    { name: 'excludeCurrentArticle', type: 'checkbox', defaultValue: true, label: 'Exclude Current Article' },
  ],
}

export const ArticleMetadataBlock: Block = {
  slug: 'articleMetadataBlock',
  labels: { singular: 'Author & Metadata Bar', plural: 'Author & Metadata Bars' },
  fields: [
    { name: 'showAuthor', type: 'checkbox', defaultValue: true, label: 'Show Author Profile' },
    { name: 'author', type: 'relationship', relationTo: 'users', label: 'Author Account' },
    { name: 'showPublishedDate', type: 'checkbox', defaultValue: true, label: 'Show Publication Date' },
    { name: 'showUpdatedDate', type: 'checkbox', defaultValue: true, label: 'Show Last Updated Date' },
    { name: 'showReadingTime', type: 'checkbox', defaultValue: true, label: 'Show Estimated Reading Time' },
    { name: 'showRelatedArticles', type: 'checkbox', defaultValue: true, label: 'Show Related Articles Footer' },
    { name: 'relatedArticles', type: 'relationship', relationTo: 'articles', hasMany: true, label: 'Specific Related Articles' },
    { name: 'relatedArticlesLimit', type: 'number', defaultValue: 3, label: 'Related Articles Count' },
    {
      name: 'relatedArticlesLayout',
      type: 'select',
      defaultValue: 'cards',
      options: [
        { label: 'Cards Grid', value: 'cards' },
        { label: 'List View', value: 'list' },
      ],
    },
  ],
}

export const EmbedBlock: Block = {
  slug: 'embedBlock',
  labels: { singular: 'Safe Embed', plural: 'Safe Embeds' },
  fields: [
    {
      name: 'provider',
      type: 'select',
      required: true,
      options: [
        { label: 'YouTube Video', value: 'youtube' },
        { label: 'Vimeo Video', value: 'vimeo' },
        { label: 'Aparat Video', value: 'aparat' },
        { label: 'Spotify Audio', value: 'spotify' },
        { label: 'SoundCloud Track', value: 'soundcloud' },
        { label: 'CodePen Snippet', value: 'codepen' },
      ],
    },
    {
      name: 'url',
      type: 'text',
      required: true,
      label: 'Embed Target URL',
      validate: (val: any, { siblingData }: any) => {
        if (!val) return 'URL is required'
        try {
          const parsed = new URL(val)
          if (!['http:', 'https:'].includes(parsed.protocol)) {
            return 'URL must use http or https'
          }
          const provider = siblingData?.provider
          if (provider === 'youtube' && !parsed.hostname.includes('youtube.com') && !parsed.hostname.includes('youtu.be')) {
            return 'Invalid YouTube URL'
          }
          if (provider === 'vimeo' && !parsed.hostname.includes('vimeo.com')) {
            return 'Invalid Vimeo URL'
          }
          if (provider === 'aparat' && !parsed.hostname.includes('aparat.com')) {
            return 'Invalid Aparat URL'
          }
          if (provider === 'spotify' && !parsed.hostname.includes('spotify.com')) {
            return 'Invalid Spotify URL'
          }
          if (provider === 'soundcloud' && !parsed.hostname.includes('soundcloud.com')) {
            return 'Invalid SoundCloud URL'
          }
          if (provider === 'codepen' && !parsed.hostname.includes('codepen.io')) {
            return 'Invalid CodePen URL'
          }
        } catch {
          return 'Invalid URL format'
        }
        return true
      },
    },
    { name: 'title', type: 'text', required: true, label: 'Accessible Embed Title' },
    { name: 'caption', type: 'text', label: 'Caption' },
    {
      name: 'aspectRatio',
      type: 'select',
      defaultValue: '16:9',
      options: [
        { label: '16:9 Widescreen', value: '16:9' },
        { label: '4:3 Standard', value: '4:3' },
        { label: '1:1 Square', value: '1:1' },
      ],
    },
    { name: 'consentRequired', type: 'checkbox', defaultValue: false, label: 'Require Cookie Consent Before Loading' },
  ],
}

export const CodeBlock: Block = {
  slug: 'codeBlock',
  labels: { singular: 'Secure Code Snippet', plural: 'Secure Code Snippets' },
  fields: [
    {
      name: 'language',
      type: 'select',
      defaultValue: 'typescript',
      required: true,
      options: [
        { label: 'TypeScript', value: 'typescript' },
        { label: 'JavaScript', value: 'javascript' },
        { label: 'JSON', value: 'json' },
        { label: 'HTML', value: 'html' },
        { label: 'CSS', value: 'css' },
        { label: 'Bash / Shell', value: 'bash' },
        { label: 'Python', value: 'python' },
        { label: 'SQL', value: 'sql' },
        { label: 'Plain Text', value: 'plaintext' },
      ],
    },
    { name: 'code', type: 'textarea', required: true, label: 'Code Snippet Content' },
    { name: 'title', type: 'text', label: 'File / Snippet Title' },
    { name: 'showLineNumbers', type: 'checkbox', defaultValue: true, label: 'Show Line Numbers' },
    { name: 'allowCopy', type: 'checkbox', defaultValue: true, label: 'Allow Copy to Clipboard' },
  ],
}

export const CustomExtensionBlock: Block = {
  slug: 'customExtensionBlock',
  labels: { singular: 'Custom Block Extension', plural: 'Custom Block Extensions' },
  fields: [
    { name: 'extensionType', type: 'text', required: true, label: 'Registered Extension Type Identifier' },
    { name: 'title', type: 'text', label: 'Extension Title' },
    { name: 'dataJson', type: 'textarea', label: 'Custom Configuration JSON' },
    { name: 'active', type: 'checkbox', defaultValue: true, label: 'Extension Active' },
  ],
}

export const ALL_ARTICLE_BLOCKS: Block[] = [
  ImageBlock,
  GalleryBlock,
  TableBlock,
  CalloutBlock,
  CtaBlock,
  TableOfContentsBlock,
  VenueCardBlock,
  MapBlock,
  EventListBlock,
  CalendarBlock,
  BannerBlock,
  VideoBlock,
  FaqBlock,
  QuoteBlock,
  StatsBlock,
  CardGridBlock,
  ComparisonBlock,
  StepsBlock,
  DownloadBlock,
  RelatedContentBlock,
  ArticleMetadataBlock,
  EmbedBlock,
  CodeBlock,
  CustomExtensionBlock,
]
