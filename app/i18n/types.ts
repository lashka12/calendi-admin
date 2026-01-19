import en from './locales/en';

// Helper type to convert all string literals to string type
type DeepString<T> = {
  [K in keyof T]: T[K] extends object ? DeepString<T[K]> : string;
};

// Use English as the source of truth for translation keys structure
// but allow any string values (for different languages)
export type Translations = DeepString<typeof en>;

// Helper type to get nested keys like 'nav.dashboard' or 'common.save'
type NestedKeyOf<T, K extends string = ''> = T extends object
  ? {
      [P in keyof T & string]: T[P] extends object
        ? NestedKeyOf<T[P], K extends '' ? P : `${K}.${P}`>
        : K extends ''
        ? P
        : `${K}.${P}`;
    }[keyof T & string]
  : never;

export type TranslationKey = NestedKeyOf<Translations>;
