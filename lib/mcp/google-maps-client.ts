import { googleMapsTools } from '../../mcp-servers/google-maps/src/index';

export const googleMapsMCP = {
  async searchPlaces(
    query: string,
    location: { lat: number; lng: number },
    radius?: number,
    type?: string
  ) {
    return await googleMapsTools.searchPlaces({
      query,
      location,
      radius,
      type,
    });
  },

  async getPlaceDetails(placeId: string) {
    return await googleMapsTools.getPlaceDetails(placeId);
  },

  async checkAccessibility(placeId: string) {
    return await googleMapsTools.checkAccessibility(placeId);
  },

  async getDirections(
    origin: string,
    destination: string,
    mode?: 'driving' | 'walking' | 'transit'
  ) {
    return await googleMapsTools.getDirections({
      origin,
      destination,
      mode,
    });
  },

  async calculateRouteTime(waypoints: string[], mode?: string) {
    return await googleMapsTools.calculateRouteTime({
      waypoints,
      mode: mode as any,
    });
  },
};
