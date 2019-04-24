import { get } from 'axios';
import elasticsearch from 'elasticsearch';
import { sortBy } from 'lodash';

const es = new elasticsearch.Client({
  host: 'localhost:9200',
});

const URL = 'https://global.adsbexchange.com/VirtualRadar/AircraftList.json?ldv=636917136118593865&stm=1556117415828&lat=51.45315114582281&lng=-0.193634033203125&fNBnd=33.7465492854683&fEBnd=-111.51760876178743&fSBnd=33.0201182768143&fWBnd=-112.4281007051468&trFmt=fa'
//const URL = 'http://public-api.adsbexchange.com/VirtualRadar/AircraftList.json?lat=33.433638&lng=-112.008113&fDstL=0&fDstU=100'

function fetchFlightData() {
  return get(URL).then(resp => resp.data.acList);
}

function indexFlightData() {
  return fetchFlightData()
    .then(list => sortBy(list, 'Lat'))
    .then(list => {
      list.forEach(ac => {
        ac['@timestamp'] = new Date(ac.PosTime).getTime();

        ac.location = {
          lat: ac.Lat,
          lon: ac.Long,
        };

        ac.Spd = Math.round(ac.Spd);

        es.index({
          index: 'adsb',
          type: '_doc',
          id: `${ac.Id}-${ac.PosTime}`,
          body: ac,
        });
      });
      return true;
    });
}

function go() {
  const again = () => setTimeout(go, 10000)
  indexFlightData().then(again).catch(again);
}

es.indices
  .create({
    index: 'adsb',
    body: {
      settings: {
        number_of_shards: 1,
      },
      mappings: {
        properties: {
          location: { type: 'geo_point' },
          '@timestamp': { type: 'date' },
        },
      },
    },
  })
  .then(go).catch(go)
