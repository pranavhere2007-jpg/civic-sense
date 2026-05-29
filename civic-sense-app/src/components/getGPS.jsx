export default function getGPS(){
    const getAccuratePosition = (minAccuracy = 50, maxAcceptableAccuracy = 3000, timeout = 15000) => {
    return new Promise((resolve, reject) => {
      let watchId;
      let bestPosition = null;

      const timer = setTimeout(() => {
        navigator.geolocation.clearWatch(watchId);
        
        // If 15 seconds pass, check our best result. 
        // If it's worse than 150 meters, REJECT IT.
        if (bestPosition && bestPosition.coords.accuracy <= maxAcceptableAccuracy) {
          console.log(`GPS locked with acceptable accuracy: ${Math.round(bestPosition.coords.accuracy)}m`);
          resolve(bestPosition); 
        } else {
          const currentAcc = bestPosition ? Math.round(bestPosition.coords.accuracy) : 'Unknown';
          reject(new Error(`GPS signal too weak (Accuracy: ${currentAcc}m). Please step outside for a clear view of the sky.`));
        }
      }, timeout);

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          // Keep tracking the best position we've seen
          if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
            bestPosition = position;
          }
          
          // If we hit our gold-standard (e.g., under 50m), resolve immediately!
          if (position.coords.accuracy <= minAccuracy) {
            clearTimeout(timer);
            navigator.geolocation.clearWatch(watchId);
            console.log(`Perfect GPS lock achieved: ${Math.round(position.coords.accuracy)}m`);
            resolve(position);
          }
        },
        (error) => {
          clearTimeout(timer);
          navigator.geolocation.clearWatch(watchId);
          reject(error);
        },
        // maximumAge: 0 forces the device to get a NEW location, not a cached one
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    });
  };
}