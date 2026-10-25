import { createContext, useContext, type ComponentProps, type PropsWithChildren } from 'react';
import { Text as NativeText, useWindowDimensions } from 'react-native';

const FontScale = createContext(1);

export function TypographyProvider({ children }: PropsWithChildren) {
  const { fontScale } = useWindowDimensions();
  return <FontScale.Provider value={fontScale}>{children}</FontScale.Provider>;
}

export function Text(props: ComponentProps<typeof NativeText>) {
  const fontScale = useContext(FontScale);
  return <NativeText key={fontScale} {...props} />;
}
