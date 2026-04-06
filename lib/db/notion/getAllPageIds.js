import BLOG from '@/blog.config'

function getIdVariants(id) {
  if (typeof id !== 'string') {
    return []
  }

  const trimmed = id.trim()
  if (!trimmed) {
    return []
  }

  const compact = trimmed.replace(/-/g, '')
  const variants = new Set([trimmed, compact])

  if (/^[0-9a-fA-F]{32}$/.test(compact)) {
    const dashed = `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`
    variants.add(dashed)
  }

  return [...variants]
}

function getBlockById(block = {}, id) {
  const keys = getIdVariants(id)
  for (const key of keys) {
    if (block?.[key]) {
      return block[key]
    }
  }
  return null
}

function shouldSkipId(id, block = {}) {
  if (typeof id !== 'string' || !id.trim()) {
    return true
  }

  const blockItem = getBlockById(block, id)
  // Notion 返回 role:none 表示无权限读取，构建时无需继续抓取
  if (blockItem?.value?.role === 'none') {
    return true
  }

  return false
}

export default function getAllPageIds(collectionQuery, collectionId, collectionView, viewIds, block = {}) {
  if (!collectionQuery && !collectionView) {
    return []
  }

  const pageSet = new Set()

  const addPageId = id => {
    if (!shouldSkipId(id, block)) {
      pageSet.add(id)
    }
  }

  const collectIdsFromView = view => {
    if (!view || typeof view !== 'object') {
      return
    }

    const idsGroup = [
      view?.blockIds,
      view?.results?.blockIds,
      view?.collection_group_results?.blockIds
    ]

    idsGroup.forEach(ids => {
      if (Array.isArray(ids)) {
        ids.forEach(addPageId)
      }
    })
  }

  const collectViewSort = viewEntry => {
    const viewValue = viewEntry?.value
    const pageSort = viewValue?.value?.page_sort || viewValue?.page_sort
    if (Array.isArray(pageSort)) {
      pageSort.forEach(addPageId)
    }
  }

  // 策略1：优先使用当前展示视图 page_sort（有顺序）
  const groupIndex = BLOG.NOTION_INDEX || 0
  const currentViewId = Array.isArray(viewIds) ? viewIds[groupIndex] : null
  if (currentViewId && collectionView) {
    collectViewSort(collectionView[currentViewId])
  }

  // 策略2：遍历所有 view 的 page_sort（兜底）
  if (pageSet.size === 0 && collectionView) {
    Object.values(collectionView).forEach(collectViewSort)
  }

  // 策略3：旧格式兼容 collection_query（collectionId 兼容多种格式）
  const collectionQueryByIds = getIdVariants(collectionId)
    .map(id => collectionQuery?.[id])
    .filter(Boolean)

  if (collectionQueryByIds.length > 0) {
    if (currentViewId) {
      for (const queryItem of collectionQueryByIds) {
        collectIdsFromView(queryItem?.[currentViewId])
      }
    }

    if (pageSet.size === 0) {
      collectionQueryByIds.forEach(queryItem => {
        Object.values(queryItem || {}).forEach(collectIdsFromView)
      })
    }
  }

  // 策略4：最后兜底，全量扫描 collection_query
  if (pageSet.size === 0 && collectionQuery && typeof collectionQuery === 'object') {
    Object.values(collectionQuery).forEach(queryItem => {
      if (queryItem && typeof queryItem === 'object') {
        Object.values(queryItem).forEach(collectIdsFromView)
      }
    })
  }

  return [...pageSet]
}
