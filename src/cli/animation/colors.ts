import chalk from 'chalk'

// Arasaka terminal color palette — red monochrome
export const PRIMARY = '#FF3333'
export const ACCENT = '#FFAAAA'
export const DIM = '#CC4444'
export const DARK = '#440011'
export const WARNING = '#F3E600'
export const BG = '#080808'

// Chalk instances
export const primary = chalk.hex(PRIMARY)
export const accent = chalk.hex(ACCENT)
export const dim = chalk.hex(DIM)
export const dark = chalk.hex(DARK)
export const warning = chalk.hex(WARNING)
export const bg = chalk.bgHex(BG)
