import { callApi } from '~/shared/api/client'

export const announcementService = {
  async getActive(placement = 'global') {
    return callApi('announcement/active', (adapter) => adapter.getActiveAnnouncements(placement))
  }
}
