import { style } from '@vanilla-extract/css'

import { subhead } from '../../nft/css/common.css'
import { sprinkles } from '../../nft/css/sprinkles.css'

export const logoContainer = style([
  sprinkles({
    display: 'flex',
    marginRight: '12',
    alignItems: 'center',
    cursor: 'pointer',
  }),
])

export const logo = style([
  sprinkles({
    display: 'block',
    color: 'textPrimary',
  }),
])

export const baseSideContainer = style([
  sprinkles({
    display: 'flex',
    width: 'full',
    flex: '1',
    flexShrink: '2',
  }),
])

export const leftSideContainer = style([
  baseSideContainer,
  sprinkles({
    alignItems: 'center',
    justifyContent: 'flex-start',
  }),
])

export const searchContainer = style([
  sprinkles({
    flex: '1',
    flexShrink: '1',
    justifyContent: { lg: 'flex-end', xl: 'center' },
    display: { sm: 'none' },
    alignSelf: 'center',
    height: '48',
    alignItems: 'flex-start',
  }),
])

export const rightSideContainer = style([
  baseSideContainer,
  sprinkles({
    alignItems: 'center',
    justifyContent: 'flex-end',
  }),
])

const baseMenuItem = style([
  subhead,
  sprinkles({
    paddingY: '8',
    paddingX: '20',
    marginY: '4',
    borderRadius: '12',
    transition: '250',
    height: 'min',
    width: 'max',
    textAlign: 'center',
    display: 'flex',
    alignItems: 'center',
    gap: '4',
  }),
  {
    lineHeight: '24px',
    textDecoration: 'none',
    ':hover': {
      background: 'rgba(255, 255, 255, 0.1)',
    },
  },
])

export const menuItem = style([
  baseMenuItem,
  sprinkles({
    color: 'white',
    opacity: '0.5',
  }),
])

export const activeMenuItem = style([
  baseMenuItem,
  sprinkles({
    color: 'white',
    background: 'backgroundFloating',
  }),
])
