export { I18nProvider, useLocale } from './useT';
export type { TFunction } from './useT';
// useT is moved to a sibling file so the I18nProvider component
// file can stay "only exports components" for react-refresh fast
// refresh. (TSX files with .ts extension can't have JSX.)
export { useT } from './useT-helper';
export { catalog, type Locale, type Catalog } from './catalog';
