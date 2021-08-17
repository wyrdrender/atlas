import { shuffle } from 'lodash'
import React, { useEffect } from 'react'

import { Logger } from '@/utils/logger'

import { getAssetUrl, testAssetDownload } from './helpers'
import { useAssetStore } from './store'

import { useStorageProviders } from '../storageProviders'

export const AssetsManager: React.FC = () => {
  const { getStorageProviders, getRandomStorageProvider } = useStorageProviders()
  const pendingAssets = useAssetStore((state) => state.pendingAssets)
  const assetIdsBeingResolved = useAssetStore((state) => state.assetIdsBeingResolved)
  const { addAsset, addAssetBeingResolved, removeAssetBeingResolved, removePendingAsset } = useAssetStore(
    (state) => state.actions
  )

  useEffect(() => {
    Object.keys(pendingAssets).forEach(async (contentId) => {
      // make sure we handle this only once
      if (assetIdsBeingResolved.has(contentId)) {
        return
      }
      addAssetBeingResolved(contentId)

      const resolutionData = pendingAssets[contentId]
      const storageProviders = await getStorageProviders()
      const shuffledStorageProviders = shuffle(storageProviders)
      const storageProvidersWithoutLiaison = shuffledStorageProviders.filter(
        (provider) => provider.id !== resolutionData.dataObject?.liaison?.id
      )
      const liaison = resolutionData.dataObject?.liaison
      const liaisonActive = liaison?.isActive && !!liaison.metadata?.match(/^https?/)
      const storageProvidersToTry = [...(liaison && liaisonActive ? [liaison] : []), ...storageProvidersWithoutLiaison]
      for (const storageProvider of storageProvidersToTry) {
        const assetUrl = getAssetUrl(resolutionData, storageProvider.metadata ?? '')
        if (!assetUrl) {
          Logger.warn('Unable to create asset url', resolutionData)
          addAsset(contentId, {})
          return
        }

        try {
          await testAssetDownload(assetUrl, resolutionData.assetType)
          addAsset(contentId, { url: assetUrl })
          removePendingAsset(contentId)
          removeAssetBeingResolved(contentId)
          return
        } catch (e) {
          // don't capture every single asset timeout as error, just log it
          Logger.error('Failed to load asset', {
            contentId,
            type: resolutionData.assetType,
            storageProviderId: storageProvider.workerId,
            storageProviderUrl: storageProvider.metadata,
            assetUrl,
          })
        }
      }
      Logger.captureError('No storage provider was able to provide asset', 'AssetsManager', null, {
        asset: {
          contentId,
          type: resolutionData.assetType,
          storageProviderIds: storageProvidersToTry.map((sp) => sp.workerId),
          storageProviderUrls: storageProvidersToTry.map((sp) => sp.metadata),
        },
      })
    })
  }, [
    addAsset,
    addAssetBeingResolved,
    assetIdsBeingResolved,
    getStorageProviders,
    getRandomStorageProvider,
    pendingAssets,
    removeAssetBeingResolved,
    removePendingAsset,
  ])

  return null
}
