export const getEnumLength = (enumValue: any): number => {
  return Object.keys(enumValue).filter(e => typeof enumValue[e] === 'number').length;
};
