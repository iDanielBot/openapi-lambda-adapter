export const safeParseJson = (stringifiedJson?: string) => {
  if (!stringifiedJson) {
    return undefined
  }

  try {
    return JSON.parse(stringifiedJson)
  } catch (err) {
    return undefined
  }
}
