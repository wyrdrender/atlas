import React, { ComponentProps, useRef } from 'react'

import { Carousel, CarouselProps } from '@/components/Carousel'
import { Arrow } from '@/components/Carousel/Carousel.styles'
import { GridHeadingContainer, TitleContainer } from '@/components/GridHeading'
import { Text } from '@/components/Text'
import { SvgActionChevronL, SvgActionChevronR, SvgControlsPlay } from '@/components/_icons'

import { CarouselArrowsContainer, Container, SeeAllLink } from './Gallery.styles'

export type GalleryProps = {
  title?: string
  className?: string
  seeAllUrl?: string
} & CarouselProps

type ImperativeHandleData = {
  getPrevArrowProps: () => ComponentProps<typeof Arrow>
  getNextArrowProps: () => ComponentProps<typeof Arrow>
}

export const Gallery: React.FC<GalleryProps> = ({ title, className, seeAllUrl, ...carouselProps }) => {
  // TODO: this is the only place in the app that requires refs to buttons. Once we refactor this component, we can remove forwardRef from buttons
  const prevArrowRef = useRef<HTMLButtonElement>(null)
  const nextArrowRef = useRef<HTMLButtonElement>(null)
  const carouselRef = useRef<ImperativeHandleData>(null)
  return (
    <Container className={className}>
      <GridHeadingContainer>
        <TitleContainer>
          {title && <Text variant="h500">{title}</Text>}
          {seeAllUrl && (
            <SeeAllLink
              iconPlacement="left"
              icon={<SvgControlsPlay width={16} height={16} />}
              textOnly
              to={seeAllUrl}
              size="large"
              variant="primary"
            >
              See all
            </SeeAllLink>
          )}
          <CarouselArrowsContainer>
            <Arrow {...carouselRef.current?.getPrevArrowProps()} ref={prevArrowRef} size="large" variant="secondary">
              <SvgActionChevronL />
            </Arrow>
            <Arrow {...carouselRef.current?.getNextArrowProps()} ref={nextArrowRef} size="large" variant="secondary">
              <SvgActionChevronR />
            </Arrow>
          </CarouselArrowsContainer>
        </TitleContainer>
      </GridHeadingContainer>
      <Carousel
        {...carouselProps}
        prevArrowRef={prevArrowRef}
        nextArrowRef={nextArrowRef}
        ref={carouselRef}
        itemWidth={350}
      />
    </Container>
  )
}
