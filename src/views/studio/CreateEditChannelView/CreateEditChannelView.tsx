import React, { useEffect, useRef, useState } from 'react'
import { Controller, FieldError, useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { CSSTransition } from 'react-transition-group'

import { useChannel } from '@/api/hooks'
import { AssetAvailability } from '@/api/queries'
import { ActionBar } from '@/components/ActionBar'
import { LimitedWidthContainer } from '@/components/LimitedWidthContainer'
import { Tooltip } from '@/components/Tooltip'
import { ViewErrorFallback } from '@/components/ViewErrorFallback'
import { ChannelCover } from '@/components/_channel/ChannelCover'
import { SvgControlsCancel } from '@/components/_icons'
import { FormField } from '@/components/_inputs/FormField'
import { Select, SelectItem } from '@/components/_inputs/Select'
import { TextArea } from '@/components/_inputs/TextArea'
import {
  ImageCropModal,
  ImageCropModalImperativeHandle,
  ImageCropModalProps,
} from '@/components/_overlays/ImageCropModal'
import { languages } from '@/config/languages'
import { absoluteRoutes } from '@/config/routes'
import { useDisplayDataLostWarning } from '@/hooks/useDisplayDataLostWarning'
import { ChannelAssets, ChannelId, CreateChannelMetadata } from '@/joystream-lib'
import { AssetType, useAsset, useAssetStore, useRawAsset } from '@/providers/assets'
import { useConnectionStatusStore } from '@/providers/connectionStatus'
import { useJoystream } from '@/providers/joystream'
import { useSnackbar } from '@/providers/snackbars'
import { useTransaction } from '@/providers/transactionManager'
import { useStartFileUpload } from '@/providers/uploadsManager/useStartFileUpload'
import { useUser } from '@/providers/user'
import { useVideoWorkspace } from '@/providers/videoWorkspace'
import { transitions } from '@/styles'
import { AssetDimensions, ImageCropData } from '@/types/cropper'
import { createId } from '@/utils/createId'
import { requiredValidation, textFieldValidation } from '@/utils/formValidationOptions'
import { computeFileHash } from '@/utils/hashing'
import { SentryLogger } from '@/utils/logs'
import { formatNumberShort } from '@/utils/number'
import { SubTitleSkeletonLoader, TitleSkeletonLoader } from '@/views/viewer/ChannelView/ChannelView.styles'

import {
  ActionBarTransactionWrapper,
  InnerFormContainer,
  StyledAvatar,
  StyledProgressDrawer,
  StyledSubTitle,
  StyledTitleArea,
  StyledTitleSection,
  TitleContainer,
} from './CreateEditChannelView.styles'

const PUBLIC_SELECT_ITEMS: SelectItem<boolean>[] = [
  { name: 'Public', value: true },
  { name: 'Unlisted (channel will not appear in feeds and search)', value: false },
]

type ImageAsset = {
  contentId: string | null
  assetDimensions: AssetDimensions | null
  imageCropData: ImageCropData | null
}
type Inputs = {
  title?: string
  description?: string
  isPublic: boolean
  language: string
  avatar: ImageAsset
  cover: ImageAsset
}

type CreateEditChannelViewProps = {
  newChannel?: boolean
}

export const CreateEditChannelView: React.FC<CreateEditChannelViewProps> = ({ newChannel }) => {
  const avatarDialogRef = useRef<ImageCropModalImperativeHandle>(null)
  const coverDialogRef = useRef<ImageCropModalImperativeHandle>(null)
  const [avatarHashPromise, setAvatarHashPromise] = useState<Promise<string> | null>(null)
  const [coverHashPromise, setCoverHashPromise] = useState<Promise<string> | null>(null)

  const { activeMemberId, activeChannelId, setActiveUser, refetchActiveMembership } = useUser()
  const { joystream } = useJoystream()
  const handleTransaction = useTransaction()
  const { displaySnackbar } = useSnackbar()
  const nodeConnectionStatus = useConnectionStatusStore((state) => state.nodeConnectionStatus)
  const navigate = useNavigate()

  const {
    channel,
    loading,
    error,
    refetch: refetchChannel,
  } = useChannel(activeChannelId || '', {
    skip: newChannel || !activeChannelId,
    onError: (error) =>
      SentryLogger.error('Failed to fetch channel', 'CreateEditChannelView', error, {
        channel: { id: activeChannelId },
      }),
  })
  const startFileUpload = useStartFileUpload()

  // trigger use asset to make sure the channel assets get resolved
  // useRawAsset is used for display to support local assets as well
  useAsset({
    entity: channel,
    assetType: AssetType.AVATAR,
  })
  useAsset({
    entity: channel,
    assetType: AssetType.COVER,
  })

  const {
    register,
    handleSubmit: createSubmitHandler,
    control,
    formState: { isDirty, dirtyFields, errors, isValid },
    watch,
    setFocus,
    setValue,
    reset,
  } = useForm<Inputs>({
    mode: 'onChange',
    defaultValues: {
      avatar: { contentId: null, assetDimensions: null, imageCropData: null },
      cover: { contentId: null, assetDimensions: null, imageCropData: null },
      title: '',
      description: '',
      language: languages[0].value,
      isPublic: true,
    },
  })

  const addAsset = useAssetStore((state) => state.actions.addAsset)
  const avatarAsset = useRawAsset(watch('avatar').contentId)
  const coverAsset = useRawAsset(watch('cover').contentId)

  const { videoWorkspaceState, anyVideoTabsCachedAssets, setVideoWorkspaceState } = useVideoWorkspace()
  const { openWarningDialog } = useDisplayDataLostWarning()

  useEffect(() => {
    if (newChannel) {
      reset({
        avatar: { contentId: null },
        cover: { contentId: null },
        title: '',
        description: '',
        language: languages[0].value,
        isPublic: true,
      })
    }
  }, [newChannel, reset])

  useEffect(() => {
    if (loading || newChannel || !channel) {
      return
    }

    const { title, description, isPublic, language } = channel

    const foundLanguage = languages.find(({ value }) => value === language?.iso)

    reset({
      avatar: {
        contentId: channel.avatarPhotoDataObject?.joystreamContentId,
        assetDimensions: null,
        imageCropData: null,
      },
      cover: {
        contentId: channel.coverPhotoDataObject?.joystreamContentId,
        assetDimensions: null,
        imageCropData: null,
      },
      title: title || '',
      description: description || '',
      isPublic: isPublic ?? false,
      language: foundLanguage?.value || languages[0].value,
    })
  }, [channel, loading, newChannel, reset])

  useEffect(() => {
    if (!dirtyFields.avatar || !avatarAsset?.blob) {
      return
    }

    const hashPromise = computeFileHash(avatarAsset.blob)
    setAvatarHashPromise(hashPromise)
  }, [dirtyFields.avatar, avatarAsset])

  useEffect(() => {
    if (!dirtyFields.cover || !coverAsset?.blob) {
      return
    }

    const hashPromise = computeFileHash(coverAsset.blob)
    setCoverHashPromise(hashPromise)
  }, [dirtyFields.cover, coverAsset])

  const handleSubmit = createSubmitHandler(async (data) => {
    if (anyVideoTabsCachedAssets) {
      openWarningDialog({ onConfirm: () => submit(data) })
    } else {
      await submit(data)
    }
  })

  const handleCoverChange: ImageCropModalProps['onConfirm'] = (
    croppedBlob,
    croppedUrl,
    assetDimensions,
    imageCropData
  ) => {
    const newCoverAssetId = `local-cover-${createId()}`
    addAsset(newCoverAssetId, { url: croppedUrl, blob: croppedBlob })
    setValue('cover', { contentId: newCoverAssetId, assetDimensions, imageCropData }, { shouldDirty: true })
  }

  const handleAvatarChange: ImageCropModalProps['onConfirm'] = (
    croppedBlob,
    croppedUrl,
    assetDimensions,
    imageCropData
  ) => {
    const newAvatarAssetId = `local-avatar-${createId()}`
    addAsset(newAvatarAssetId, { url: croppedUrl, blob: croppedBlob })
    setValue('avatar', { contentId: newAvatarAssetId, assetDimensions, imageCropData }, { shouldDirty: true })
  }

  const submit = async (data: Inputs) => {
    if (!joystream || !activeMemberId) {
      return
    }

    setVideoWorkspaceState('closed')

    const metadata: CreateChannelMetadata = {
      ...(dirtyFields.title ? { title: data.title ?? '' } : {}),
      ...(dirtyFields.description ? { description: data.description ?? '' } : {}),
      ...(dirtyFields.language || newChannel ? { language: data.language } : {}),
      ...(dirtyFields.isPublic || newChannel ? { isPublic: data.isPublic } : {}),
    }

    const assets: ChannelAssets = {}
    let avatarContentId = ''
    let coverContentId = ''

    const processAssets = async () => {
      if (dirtyFields.avatar && avatarAsset?.blob && avatarHashPromise) {
        const [asset, contentId] = joystream.createFileAsset({
          size: avatarAsset.blob.size,
          ipfsContentId: await avatarHashPromise,
        })
        assets.avatar = asset
        avatarContentId = contentId
      }

      if (dirtyFields.cover && coverAsset?.blob && coverHashPromise) {
        const [asset, contentId] = joystream.createFileAsset({
          size: coverAsset?.blob.size,
          ipfsContentId: await coverHashPromise,
        })
        assets.cover = asset
        coverContentId = contentId
      }
    }

    const uploadAssets = async (channelId: ChannelId) => {
      const uploadPromises: Promise<unknown>[] = []
      if (avatarAsset?.blob && avatarContentId) {
        const uploadPromise = startFileUpload(avatarAsset.blob, {
          contentId: avatarContentId,
          owner: channelId,
          parentObject: {
            type: 'channel',
            id: channelId,
          },
          dimensions: data.avatar.assetDimensions ?? undefined,
          imageCropData: data.avatar.imageCropData ?? undefined,
          type: 'avatar',
        })
        uploadPromises.push(uploadPromise)
      }
      if (coverAsset?.blob && coverContentId) {
        const uploadPromise = startFileUpload(coverAsset.blob, {
          contentId: coverContentId,
          owner: channelId,
          parentObject: {
            type: 'channel',
            id: channelId,
          },
          dimensions: data.cover.assetDimensions ?? undefined,
          imageCropData: data.cover.imageCropData ?? undefined,
          type: 'cover',
        })
        uploadPromises.push(uploadPromise)
      }
      Promise.all(uploadPromises).catch((e) =>
        SentryLogger.error('Unexpected upload failure', 'CreateEditChannelView', e)
      )
    }

    const refetchDataAndCacheAssets = async (channelId: ChannelId) => {
      if (avatarContentId && avatarAsset?.url) {
        addAsset(avatarContentId, { url: avatarAsset.url })
      }
      if (coverContentId && coverAsset?.url) {
        addAsset(coverContentId, { url: coverAsset.url })
      }

      const refetchPromiseList = [refetchActiveMembership(), ...(!newChannel ? [refetchChannel()] : [])]
      await Promise.all(refetchPromiseList)

      if (newChannel) {
        setActiveUser({ channelId })
      }
    }

    const completed = await handleTransaction({
      preProcess: processAssets,
      txFactory: (updateStatus) =>
        newChannel
          ? joystream.createChannel(activeMemberId, metadata, assets, updateStatus)
          : joystream.updateChannel(activeChannelId ?? '', activeMemberId, metadata, assets, updateStatus),
      onTxFinalize: uploadAssets,
      onTxSync: refetchDataAndCacheAssets,
      successMessage: {
        title: newChannel ? 'Channel successfully created!' : 'Channel successfully updated!',
        description: newChannel
          ? 'Your channel was created and saved on the blockchain. Feel free to start using it!'
          : 'Changes to your channel were saved on the blockchain.',
      },
    })

    if (completed && newChannel) {
      navigate(absoluteRoutes.studio.videos())
    }
  }

  if (error) {
    return <ViewErrorFallback />
  }

  const progressDrawerSteps = [
    {
      title: 'Add channel title',
      completed: !!dirtyFields.title,
      onClick: () => setFocus('title'),
    },
    {
      title: 'Add description',
      completed: !!dirtyFields.description,
      onClick: () => setFocus('description'),
    },
    {
      title: 'Add avatar image',
      completed: !!dirtyFields.avatar,
      onClick: () => avatarDialogRef.current?.open(),
    },
    {
      title: 'Add cover image',
      completed: !!dirtyFields.cover,
      onClick: () => coverDialogRef.current?.open(),
    },
  ]

  const hasAvatarUploadFailed = channel?.avatarPhotoAvailability === AssetAvailability.Pending
  const hasCoverUploadFailed = channel?.coverPhotoAvailability === AssetAvailability.Pending
  const isDisabled = !isDirty || nodeConnectionStatus !== 'connected' || !isValid

  return (
    <form onSubmit={handleSubmit}>
      <Controller
        name="cover"
        control={control}
        render={() => (
          <>
            <ChannelCover
              assetUrl={loading ? null : coverAsset?.url}
              hasCoverUploadFailed={hasCoverUploadFailed}
              onCoverEditClick={() => coverDialogRef.current?.open()}
              editable
              disabled={loading}
            />
            <ImageCropModal
              imageType="cover"
              onConfirm={handleCoverChange}
              onError={() =>
                displaySnackbar({
                  title: 'Cannot load the image. Choose another.',
                  iconType: 'error',
                })
              }
              ref={coverDialogRef}
            />
          </>
        )}
      />

      <StyledTitleSection className={transitions.names.slide}>
        <Controller
          name="avatar"
          control={control}
          render={() => (
            <>
              <StyledAvatar
                assetUrl={avatarAsset?.url}
                hasAvatarUploadFailed={hasAvatarUploadFailed}
                size="fill"
                onEditClick={() => avatarDialogRef.current?.open()}
                editable
                loading={loading}
              />
              <ImageCropModal
                imageType="avatar"
                onConfirm={handleAvatarChange}
                onError={() =>
                  displaySnackbar({
                    title: 'Cannot load the image. Choose another.',
                    iconType: 'error',
                  })
                }
                ref={avatarDialogRef}
              />
            </>
          )}
        />

        <TitleContainer>
          {!loading || newChannel ? (
            <>
              <Controller
                name="title"
                control={control}
                rules={textFieldValidation({ name: 'Channel name', minLength: 3, maxLength: 40, required: true })}
                render={({ field: { value, onChange } }) => (
                  <Tooltip text="Click to edit channel title" placement="top-start">
                    <StyledTitleArea min={3} max={40} placeholder="Channel title" value={value} onChange={onChange} />
                  </Tooltip>
                )}
              />
              {!newChannel && (
                <StyledSubTitle variant="t200">
                  {channel?.follows ? formatNumberShort(channel.follows) : 0} Followers
                </StyledSubTitle>
              )}
            </>
          ) : (
            <>
              <TitleSkeletonLoader />
              <SubTitleSkeletonLoader />
            </>
          )}
        </TitleContainer>
      </StyledTitleSection>
      <LimitedWidthContainer>
        <InnerFormContainer>
          <FormField title="Description">
            <Tooltip text="Click to edit channel description">
              <TextArea
                placeholder="Description of your channel to share with your audience"
                rows={8}
                {...register(
                  'description',
                  textFieldValidation({ name: 'Description', minLength: 3, maxLength: 1000 })
                )}
                maxLength={1000}
                error={!!errors.description}
                helperText={errors.description?.message}
              />
            </Tooltip>
          </FormField>
          <FormField title="Language" description="Main language of the content you publish on your channel">
            <Controller
              name="language"
              control={control}
              rules={requiredValidation('Language')}
              render={({ field: { value, onChange } }) => (
                <Select
                  items={languages}
                  disabled={loading}
                  value={value}
                  onChange={onChange}
                  error={!!errors.language && !value}
                  helperText={(errors.language as FieldError)?.message}
                />
              )}
            />
          </FormField>

          <FormField
            title="Privacy"
            description="Privacy of your channel. Please note that because of nature of the blockchain, even unlisted channels can be publicly visible by querying the blockchain data."
          >
            <Controller
              name="isPublic"
              control={control}
              render={({ field: { value, onChange } }) => (
                <Select
                  items={PUBLIC_SELECT_ITEMS}
                  disabled={loading}
                  value={value}
                  onChange={onChange}
                  error={!!errors.isPublic && !value}
                  helperText={(errors.isPublic as FieldError)?.message}
                />
              )}
            />
          </FormField>
          <CSSTransition
            in={videoWorkspaceState !== 'open'}
            timeout={2 * parseInt(transitions.timings.loading)}
            classNames={transitions.names.fade}
            unmountOnExit
          >
            <ActionBarTransactionWrapper>
              {!activeChannelId && progressDrawerSteps?.length ? (
                <StyledProgressDrawer steps={progressDrawerSteps} />
              ) : null}
              <ActionBar
                primaryText="Fee: 0 Joy"
                secondaryText="For the time being no fees are required for blockchain transactions. This will change in the future."
                isEdit={!newChannel}
                primaryButton={{
                  text: newChannel ? 'Create channel' : 'Publish changes',
                  disabled: isDisabled,
                  onClick: handleSubmit,
                  tooltip: isDisabled
                    ? {
                        headerText: newChannel
                          ? 'Fill all required fields to proceed'
                          : isValid
                          ? 'Change anything to proceed'
                          : 'Fill all required fields to proceed',
                        text: newChannel
                          ? 'Required: title'
                          : isValid
                          ? 'To publish changes you have to provide new value to any field'
                          : 'Required: title',
                        icon: true,
                      }
                    : undefined,
                }}
                secondaryButton={{
                  visible: !newChannel && isDirty && nodeConnectionStatus === 'connected',
                  text: 'Cancel',
                  onClick: () => reset(),
                  icon: <SvgControlsCancel width={16} height={16} />,
                }}
              />
            </ActionBarTransactionWrapper>
          </CSSTransition>
        </InnerFormContainer>
      </LimitedWidthContainer>
    </form>
  )
}
