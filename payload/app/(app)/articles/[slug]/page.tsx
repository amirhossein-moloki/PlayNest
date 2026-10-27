import React from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { ArticleRenderer } from '../../../../src/components/ArticleRenderer.js'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface ArticlePageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ArticlePageProps) {
  const { slug } = await params
  const payload = await getPayload({ config: configPromise })
  const result = await payload.find({
    collection: 'articles',
    where: {
      slug: { equals: slug },
      status: { equals: 'published' },
    },
    limit: 1,
  })

  const article = result.docs[0]
  if (!article) return { title: 'Article Not Found' }

  return {
    title: article.seo?.title || article.title,
    description: article.seo?.description || `Read ${article.title} on PlayNest`,
    keywords: article.seo?.keywords,
  }
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'articles',
    where: {
      slug: { equals: slug },
      status: { equals: 'published' },
    },
    limit: 1,
  })

  const article = result.docs[0]
  if (!article) {
    notFound()
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    datePublished: article.publishedAt || article.createdAt,
    dateModified: article.updatedAt,
    author: {
      '@type': 'Organization',
      name: 'PlayNest Editorial',
    },
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8 dir-auto">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-10">
        <header className="mb-8 border-b border-gray-200 pb-6">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight">
            {article.title}
          </h1>
          {article.publishedAt && (
            <time className="block text-xs font-medium text-gray-500 mt-3">
              Published on {new Date(article.publishedAt).toLocaleDateString()}
            </time>
          )}
        </header>

        {article.heroMedia && typeof article.heroMedia === 'object' && (article.heroMedia as any).url && (
          <div className="mb-8 rounded-xl overflow-hidden max-h-96 w-full">
            <img
              src={(article.heroMedia as any).url}
              alt={article.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <ArticleRenderer content={article.content} />
      </div>
    </main>
  )
}
