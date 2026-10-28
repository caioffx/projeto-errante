import { RawListRemoteZimFilesResponse, RawRemoteZimFileEntry } from '../types/zim.js'

export function isRawListRemoteZimFilesResponse(obj: any): obj is RawListRemoteZimFilesResponse {
  if (!(obj && typeof obj === 'object' && 'feed' in obj)) {
    return false
  }
  if (!obj.feed || typeof obj.feed !== 'object') {
    return false
  }
  if (!('entry' in obj.feed)) {
    return true // entry é opcional e pode estar ausente quando não há resultados
  }

  if ('entry' in obj.feed && typeof obj.feed.entry !== 'object') {
    return false //  Se entry existir, deverá ser um objeto ou um array
  }

  return true
}

export function isRawRemoteZimFileEntry(obj: any): obj is RawRemoteZimFileEntry {
  return obj && typeof obj === 'object' && 'id' in obj && 'title' in obj && 'summary' in obj
}
