import BLOG from '@/blog.config'
import { idToUuid } from 'notion-utils'

export default function getAllPageIds(collectionQuery, collectionId, collectionView, viewIds) {
  if (!collectionQuery && !collectionView) {
    return []
  }

  const pageSet = new Set()

  const addPageId = id => {
    if (typeof id === 'string' && id.trim()) {
      pageSet.add(id)
    }
  }

  const collectIdsFromView = view => {
    if (!view || typeof view !== 'object') {
      return
    }
    view?.blockIds?.forEach(addPageId)
    view?.results?.blockIds?.forEach(addPageId)
    view?.collection_group_results?.blockIds?.forEach(addPageId)
  }

  try {
    // Prefer the configured view order from Notion when available.
    const groupIndex = BLOG.NOTION_INDEX || 0
    const currentViewId = Array.isArray(viewIds) ? viewIds[groupIndex] : null
    const normalizedCollectionId =
      typeof collectionId === 'string' ? idToUuid(collectionId) : null

    const pageSort = collectionView?.[currentViewId]?.value?.page_sort
    if (Array.isArray(pageSort)) {
      pageSort.forEach(addPageId)
    }

    const collectionQueryById =
      collectionQuery?.[collectionId] ||
      (normalizedCollectionId ? collectionQuery?.[normalizedCollectionId] : null)

    if (collectionQueryById && currentViewId) {
      collectIdsFromView(collectionQueryById[currentViewId])
    }

    // Fallback: scan all views under the matched collection id.
    if (pageSet.size === 0 && collectionQueryById) {
      Object.values(collectionQueryById).forEach(collectIdsFromView)
    }

    // Last fallback: scan the whole collection_query when ids do not match.
    if (pageSet.size === 0 && collectionQuery && typeof collectionQuery === 'object') {
      Object.values(collectionQuery).forEach(queryItem => {
        if (queryItem && typeof queryItem === 'object') {
          Object.values(queryItem).forEach(collectIdsFromView)
        }
      })
    }
  } catch (error) {
    console.error('Error fetching page IDs:', {
      collectionId,
      viewIds,
      error
    })
  }

  return [...pageSet]
}
