import type { Expense, Maintenance, Refueling, Reminder, Vehicle } from "../types"
import { db } from "./db"

const VEHICLE_ID = "veh-citroen-c4"
const PLATE = "CJ-653-HM"

const fills: Array<{
  date: string
  km: number
  litres: number
  prix: number
  cout: number
  partial?: boolean
}> = [
  { date: "2017-02-24T12:00:00", km: 43663, litres: 56.693, prix: 1.27, cout: 72.0 },
  { date: "2017-05-28T12:00:00", km: 44486, litres: 47.146, prix: 1.209, cout: 57.0 },
  { date: "2017-07-08T12:00:00", km: 44862, litres: 62.665, prix: 1.133, cout: 71.0 },
  { date: "2017-07-13T12:00:00", km: 45380, litres: 18.502, prix: 1.135, cout: 21.0 },
  { date: "2017-07-14T12:00:00", km: 45705, litres: 35.372, prix: 1.329, cout: 47.01 },
  { date: "2017-09-03T12:00:00", km: 49567, litres: 44.092, prix: 1.168, cout: 51.5 },
  { date: "2017-09-24T12:00:00", km: 50305, litres: 40.494, prix: 1.235, cout: 50.01 },
  { date: "2017-10-26T12:00:00", km: 51164, litres: 47.773, prix: 1.235, cout: 59.0 },
  { date: "2017-12-28T09:00:00", km: 52118, litres: 47.773, prix: 1.235, cout: 59.0 },
  { date: "2018-01-21T12:00:00", km: 52886, litres: 45.091, prix: 1.375, cout: 62.0 },
  { date: "2018-03-10T12:00:00", km: 53656, litres: 44.81, prix: 1.339, cout: 60.0 },
  { date: "2018-04-12T12:00:00", km: 54511, litres: 47.48, prix: 1.369, cout: 65.0 },
  { date: "2018-05-21T12:00:00", km: 55569, litres: 57.012, prix: 1.456, cout: 83.01 },
  { date: "2018-07-10T12:00:00", km: 56592, litres: 53.073, prix: 1.432, cout: 76.0, partial: true },
  { date: "2018-08-05T12:00:00", km: 57495, litres: 49.123, prix: 1.425, cout: 70.0 },
  { date: "2018-08-15T12:00:00", km: 58228, litres: 38.757, prix: 1.432, cout: 55.5 },
  { date: "2018-08-30T12:00:00", km: 59218, litres: 54.52, prix: 1.449, cout: 79.0 },
  { date: "2018-09-22T12:00:00", km: 59967, litres: 17.072, prix: 1.465, cout: 25.01, partial: true },
  { date: "2018-09-29T12:00:00", km: 60371, litres: 48.032, prix: 1.499, cout: 72.0 },
  { date: "2018-10-27T12:00:00", km: 61157, litres: 44.678, prix: 1.522, cout: 68.0 },
  { date: "2018-11-24T12:00:00", km: 61970, litres: 46.683, prix: 1.459, cout: 68.11 },
  { date: "2018-12-09T12:00:00", km: 62703, litres: 46.717, prix: 1.392, cout: 65.03 },
  { date: "2018-12-24T12:00:00", km: 63613, litres: 54.708, prix: 1.336, cout: 73.09 },
  { date: "2018-12-30T12:00:00", km: 63935, litres: 18.113, prix: 1.325, cout: 24.0 },
  { date: "2019-01-13T12:00:00", km: 64828, litres: 37.195, prix: 1.362, cout: 50.66 },
  { date: "2019-01-19T12:00:00", km: 65216, litres: 23.222, prix: 1.378, cout: 32.0 },
  { date: "2019-02-03T12:00:00", km: 66083, litres: 17.618, prix: 1.419, cout: 25.0 },
  { date: "2019-02-09T12:00:00", km: 66398, litres: 52.292, prix: 1.396, cout: 73.0 },
  { date: "2019-02-22T12:00:00", km: 67065, litres: 41.399, prix: 1.401, cout: 58.0 },
  { date: "2019-03-10T12:00:00", km: 67928, litres: 50.871, prix: 1.435, cout: 73.0 },
  { date: "2019-03-23T12:00:00", km: 68644, litres: 43.492, prix: 1.449, cout: 63.02 },
  { date: "2019-04-09T12:00:00", km: 69514, litres: 52.558, prix: 1.427, cout: 75.0 },
  { date: "2019-04-21T12:00:00", km: 70279, litres: 47.652, prix: 1.427, cout: 68.0 },
  { date: "2019-05-04T12:00:00", km: 71102, litres: 45.892, prix: 1.475, cout: 67.69 },
  { date: "2019-05-19T12:00:00", km: 71995, litres: 50.438, prix: 1.507, cout: 76.01 },
  { date: "2019-06-04T12:00:00", km: 72938, litres: 54.591, prix: 1.429, cout: 78.01 },
  { date: "2019-06-17T12:00:00", km: 73868, litres: 49.817, prix: 1.365, cout: 68.0 },
  { date: "2019-07-02T12:00:00", km: 74926, litres: 55.043, prix: 1.408, cout: 77.5 },
  { date: "2019-07-13T12:00:00", km: 75810, litres: 45.758, prix: 1.405, cout: 64.29 },
  { date: "2019-07-24T12:00:00", km: 76835, litres: 50.823, prix: 1.397, cout: 71.0 },
  { date: "2019-08-07T12:00:00", km: 77989, litres: 56.794, prix: 1.391, cout: 79.0 },
  { date: "2019-08-19T12:00:00", km: 79034, litres: 51.803, prix: 1.392, cout: 72.11 },
  { date: "2019-08-31T12:00:00", km: 80101, litres: 53.957, prix: 1.39, cout: 75.0 },
  { date: "2019-10-04T12:00:00", km: 81176, litres: 55.004, prix: 1.409, cout: 77.5 },
  { date: "2019-10-15T12:00:00", km: 81960, litres: 41.931, prix: 1.419, cout: 59.5 },
  { date: "2019-10-31T12:00:00", km: 82939, litres: 53.502, prix: 1.439, cout: 76.99 },
  { date: "2019-11-12T12:00:00", km: 83754, litres: 44.599, prix: 1.435, cout: 64.0 },
  { date: "2019-12-01T12:00:00", km: 84439, litres: 42.46, prix: 1.439, cout: 61.1 },
  { date: "2019-12-20T12:00:00", km: 85152, litres: 41.638, prix: 1.465, cout: 61.0 },
  { date: "2020-01-09T12:00:00", km: 86041, litres: 51.532, prix: 1.475, cout: 76.01 },
  { date: "2020-02-08T12:00:00", km: 87379, litres: 48.378, prix: 1.356, cout: 65.6 },
  { date: "2020-02-22T12:00:00", km: 88225, litres: 47.059, prix: 1.36, cout: 64.0 },
  { date: "2020-03-10T12:00:00", km: 89100, litres: 52.549, prix: 1.275, cout: 67.0 },
  { date: "2020-04-27T12:00:00", km: 89599, litres: 27.564, prix: 1.125, cout: 31.01 },
  { date: "2020-07-09T12:00:00", km: 90511, litres: 51.822, prix: 1.235, cout: 64.0 },
  { date: "2020-08-04T12:00:00", km: 91387, litres: 47.974, prix: 1.209, cout: 58.0 },
  { date: "2020-08-22T12:00:00", km: 92306, litres: 50.413, prix: 1.21, cout: 61.0 },
  { date: "2020-09-11T12:00:00", km: 93064, litres: 44.264, prix: 1.175, cout: 52.01 },
  { date: "2020-10-03T12:00:00", km: 93695, litres: 36.472, prix: 1.179, cout: 43.0 },
  { date: "2020-10-12T12:00:00", km: 94272, litres: 20.851, prix: 1.199, cout: 25.0 },
  { date: "2020-11-02T12:00:00", km: 94999, litres: 50.479, prix: 1.149, cout: 58.0 },
  { date: "2020-12-12T12:00:00", km: 95942, litres: 36.437, prix: 1.235, cout: 45.0 },
  { date: "2020-12-28T12:00:00", km: 96583, litres: 56.313, prix: 1.245, cout: 70.11 },
  { date: "2021-01-23T12:00:00", km: 97245, litres: 41.232, prix: 1.274, cout: 52.53 },
  { date: "2021-02-28T12:00:00", km: 98147, litres: 55.019, prix: 1.345, cout: 74.0 },
  { date: "2021-04-10T12:00:00", km: 98996, litres: 53.532, prix: 1.345, cout: 72.0 },
  { date: "2021-05-04T12:00:00", km: 99860, litres: 52.399, prix: 1.355, cout: 71.0 },
  { date: "2021-05-25T12:00:00", km: 100728, litres: 54.127, prix: 1.369, cout: 74.1 },
  { date: "2021-06-20T12:00:00", km: 101650, litres: 54.508, prix: 1.393, cout: 75.93 },
  { date: "2021-07-10T12:00:00", km: 102512, litres: 51.681, prix: 1.374, cout: 71.01 },
  { date: "2021-07-28T12:00:00", km: 103267, litres: 28.409, prix: 1.408, cout: 40.0 },
  { date: "2021-08-09T12:00:00", km: 103983, litres: 55.268, prix: 1.435, cout: 79.31 },
  { date: "2021-08-26T12:00:00", km: 104858, litres: 48.963, prix: 1.389, cout: 68.01 },
  { date: "2021-09-23T12:00:00", km: 105904, litres: 56.321, prix: 1.438, cout: 80.99 },
  { date: "2021-10-16T12:00:00", km: 106819, litres: 53.199, prix: 1.56, cout: 82.99 },
  { date: "2021-10-24T12:00:00", km: 107750, litres: 50.57, prix: 1.509, cout: 76.31 },
  { date: "2021-11-03T12:00:00", km: 108566, litres: 43.497, prix: 1.527, cout: 66.42 },
  { date: "2021-11-22T12:00:00", km: 109425, litres: 48.909, prix: 1.513, cout: 74.0 },
  { date: "2021-12-07T12:00:00", km: 110191, litres: 45.732, prix: 1.509, cout: 69.01 },
  { date: "2021-12-22T12:00:00", km: 110655, litres: 29.452, prix: 1.46, cout: 43.0 },
  { date: "2022-01-14T12:00:00", km: 111579, litres: 52.632, prix: 1.615, cout: 85.0 },
  { date: "2022-02-13T12:00:00", km: 112450, litres: 36.392, prix: 1.649, cout: 60.01, partial: true },
  { date: "2022-02-28T12:00:00", km: 112966, litres: 49.572, prix: 1.775, cout: 87.99 },
  { date: "2022-03-22T12:00:00", km: 113897, litres: 47.969, prix: 1.945, cout: 93.3 },
  { date: "2022-04-09T12:00:00", km: 114993, litres: 52.309, prix: 1.78, cout: 93.11 },
  { date: "2022-04-19T12:00:00", km: 115944, litres: 44.811, prix: 1.773, cout: 79.45 },
  { date: "2022-04-25T12:00:00", km: 116719, litres: 37.11, prix: 1.789, cout: 66.39 },
  { date: "2022-05-02T12:00:00", km: 117788, litres: 51.638, prix: 1.801, cout: 93.0 },
  { date: "2022-05-17T12:00:00", km: 119914, litres: 46.581, prix: 1.825, cout: 85.01 },
  { date: "2022-05-23T12:00:00", km: 120792, litres: 37.88, prix: 1.769, cout: 67.01 },
  { date: "2022-05-30T12:00:00", km: 121434, litres: 20.888, prix: 1.915, cout: 40.0 },
  { date: "2022-06-03T12:00:00", km: 122064, litres: 38.2, prix: 1.859, cout: 71.01 },
  { date: "2022-06-15T12:00:00", km: 123066, litres: 44.169, prix: 2.058, cout: 90.9 },
  { date: "2022-07-11T12:00:00", km: 124212, litres: 20.639, prix: 1.986, cout: 40.99 },
  { date: "2022-07-12T12:00:00", km: 124268, litres: 36.181, prix: 1.935, cout: 70.01 },
  { date: "2022-07-14T12:00:00", km: 124574, litres: 15.136, prix: 1.982, cout: 30.0 },
  { date: "2022-07-15T12:00:00", km: 125331, litres: 44.719, prix: 1.924, cout: 86.04 },
  { date: "2022-07-18T12:00:00", km: 126066, litres: 42.309, prix: 1.962, cout: 83.01 },
  { date: "2022-07-23T12:00:00", km: 126922, litres: 49.338, prix: 1.889, cout: 93.2 },
  { date: "2022-07-25T09:00:00", km: 127878, litres: 15.05, prix: 1.994, cout: 30.01 },
  { date: "2022-07-25T13:00:00", km: 128056, litres: 47.559, prix: 1.872, cout: 89.03 },
  { date: "2022-08-19T12:00:00", km: 128845, litres: 41.18, prix: 1.797, cout: 74.0 },
  { date: "2022-09-05T12:00:00", km: 129586, litres: 37.361, prix: 1.633, cout: 61.01 },
  { date: "2022-09-26T12:00:00", km: 130415, litres: 17.591, prix: 1.706, cout: 30.01 },
  { date: "2022-10-08T12:00:00", km: 130986, litres: 52.672, prix: 1.86, cout: 97.97 },
  { date: "2022-11-07T12:00:00", km: 132096, litres: 53.339, prix: 1.8, cout: 96.01 },
  { date: "2022-11-19T12:00:00", km: 132694, litres: 32.062, prix: 1.896, cout: 60.79 },
  { date: "2022-12-02T12:00:00", km: 133552, litres: 16.67, prix: 1.799, cout: 29.99 },
  { date: "2022-12-09T12:00:00", km: 134052, litres: 55.341, prix: 1.717, cout: 95.02 },
  { date: "2022-12-23T12:00:00", km: 134739, litres: 37.102, prix: 1.732, cout: 64.26 },
  { date: "2023-01-10T12:00:00", km: 135638, litres: 47.461, prix: 1.875, cout: 88.99 },
  { date: "2023-01-21T12:00:00", km: 136212, litres: 31.283, prix: 1.918, cout: 60.0 },
  { date: "2023-01-28T12:00:00", km: 136724, litres: 25.872, prix: 1.933, cout: 50.01 },
  { date: "2023-02-11T12:00:00", km: 137656, litres: 52.049, prix: 1.825, cout: 94.99 },
  { date: "2023-02-20T12:00:00", km: 138122, litres: 24.852, prix: 1.828, cout: 45.43 },
  { date: "2023-03-10T12:00:00", km: 138666, litres: 27.211, prix: 1.843, cout: 50.15 },
  { date: "2023-03-21T12:00:00", km: 139137, litres: 24.328, prix: 1.837, cout: 44.69 },
  { date: "2023-04-20T12:00:00", km: 140198, litres: 23.97, prix: 1.879, cout: 45.04 },
  { date: "2023-05-10T12:00:00", km: 140676, litres: 52.27, prix: 1.643, cout: 85.88 },
  { date: "2023-06-05T12:00:00", km: 141617, litres: 19.958, prix: 1.682, cout: 33.57 },
  { date: "2023-06-08T12:00:00", km: 141891, litres: 42.772, prix: 1.753, cout: 74.98 },
  { date: "2023-06-11T12:00:00", km: 142699, litres: 44.082, prix: 1.678, cout: 73.97 },
  { date: "2023-06-13T12:00:00", km: 143517, litres: 44.669, prix: 1.679, cout: 75.0 },
  { date: "2023-06-28T12:00:00", km: 144513, litres: 17.662, prix: 1.698, cout: 29.99 },
  { date: "2023-07-14T12:00:00", km: 144948, litres: 30.562, prix: 1.636, cout: 50.0 },
  { date: "2023-07-25T12:00:00", km: 145499, litres: 23.262, prix: 1.72, cout: 40.01 },
  { date: "2023-08-10T12:00:00", km: 145905, litres: 9.32, prix: 1.823, cout: 16.99 },
  { date: "2023-09-10T12:00:00", km: 146081, litres: 30.737, prix: 1.886, cout: 57.97, partial: true },
  { date: "2024-04-14T12:00:00", km: 146551, litres: 21.96, prix: 1.821, cout: 39.99 },
  { date: "2024-04-20T12:00:00", km: 147003, litres: 19.791, prix: 1.769, cout: 35.01 },
  { date: "2024-05-02T12:00:00", km: 147463, litres: 17.658, prix: 1.699, cout: 30.0 },
  { date: "2024-05-10T12:00:00", km: 147766, litres: 44.23, prix: 1.832, cout: 81.03 },
  { date: "2024-05-19T12:00:00", km: 148427, litres: 33.671, prix: 1.719, cout: 57.88 },
  { date: "2024-07-27T12:00:00", km: 150539, litres: 54.982, prix: 1.666, cout: 91.6 },
  { date: "2024-08-18T12:00:00", km: 151315, litres: 42.05, prix: 1.585, cout: 66.65 },
  { date: "2024-09-06T12:00:00", km: 152172, litres: 46.193, prix: 1.639, cout: 75.71 },
  { date: "2024-10-01T12:00:00", km: 152909, litres: 42.358, prix: 1.599, cout: 67.73 },
  { date: "2024-11-01T12:00:00", km: 153762, litres: 47.733, prix: 1.579, cout: 75.37 },
  { date: "2024-12-09T12:00:00", km: 155389, litres: 33.788, prix: 1.629, cout: 55.04 },
  { date: "2024-12-30T12:00:00", km: 156329, litres: 49.751, prix: 1.646, cout: 81.89 },
  { date: "2025-02-08T12:00:00", km: 157289, litres: 52.662, prix: 1.709, cout: 90.0 },
  { date: "2025-03-02T12:00:00", km: 158238, litres: 52.661, prix: 1.785, cout: 94.0 },
  { date: "2025-03-23T12:00:00", km: 159173, litres: 47.859, prix: 1.719, cout: 82.27 },
  { date: "2025-04-12T12:00:00", km: 160212, litres: 52.237, prix: 1.569, cout: 81.96 },
  { date: "2025-05-03T12:00:00", km: 161169, litres: 51.661, prix: 1.529, cout: 78.99 },
  { date: "2025-05-20T12:00:00", km: 162299, litres: 56.55, prix: 1.539, cout: 87.03 },
  { date: "2025-05-28T12:00:00", km: 163252, litres: 47.403, prix: 1.54, cout: 73.0 },
  { date: "2025-06-05T12:00:00", km: 164182, litres: 47.121, prix: 1.549, cout: 72.99 },
  { date: "2025-06-15T12:00:00", km: 164968, litres: 42.112, prix: 1.662, cout: 69.99 },
  { date: "2025-07-01T12:00:00", km: 165964, litres: 51.58, prix: 1.57, cout: 80.98 },
  { date: "2025-07-12T12:00:00", km: 166856, litres: 47.192, prix: 1.695, cout: 79.99 },
  { date: "2025-07-16T12:00:00", km: 167819, litres: 50.462, prix: 1.625, cout: 82.0 },
  { date: "2025-07-30T12:00:00", km: 168985, litres: 57.872, prix: 1.659, cout: 96.01 },
  { date: "2025-08-08T12:00:00", km: 169942, litres: 45.003, prix: 1.599, cout: 71.96 },
  { date: "2025-08-23T12:00:00", km: 171172, litres: 58.458, prix: 1.505, cout: 87.98 },
  { date: "2025-09-06T12:00:00", km: 172234, litres: 51.643, prix: 1.491, cout: 77.0 },
  { date: "2025-09-23T12:00:00", km: 173340, litres: 55.862, prix: 1.629, cout: 91.0 },
  { date: "2025-10-13T12:00:00", km: 174420, litres: 18.762, prix: 1.599, cout: 30.0 },
  { date: "2025-10-19T12:00:00", km: 174782, litres: 9.778, prix: 1.58, cout: 15.45 },
  { date: "2025-10-23T12:00:00", km: 174887, litres: 55.16, prix: 1.686, cout: 93.0 },
  { date: "2025-10-26T12:00:00", km: 175646, litres: 41.983, prix: 1.548, cout: 64.99 },
  { date: "2025-10-31T12:00:00", km: 176595, litres: 57.137, prix: 1.629, cout: 93.08 },
  { date: "2025-11-19T12:00:00", km: 177675, litres: 58.609, prix: 1.675, cout: 98.17 },
]

const initialMaintenances: Array<{
  date: string
  km: number
  typeEntretien: string
  cout: number
  notes: string
}> = [
  { date: "2017-12-28T13:00:00", km: 52620, typeEntretien: "Changement d'huile (+3)", cout: 65.0, notes: "+3 autre(s) élément(s)" },
  { date: "2019-06-08T12:00:00", km: 73318, typeEntretien: "Changement d'huile (+3)", cout: 92.58, notes: "+3 autre(s) élément(s)" },
  { date: "2020-09-01T12:00:00", km: 92680, typeEntretien: "Changement d'huile (+2)", cout: 72.91, notes: "+2 autre(s) élément(s)" },
  { date: "2022-03-19T12:00:00", km: 113530, typeEntretien: "Changement d'huile (+2)", cout: 53.0, notes: "+2 autre(s) élément(s)" },
  { date: "2025-10-28T12:00:00", km: 176376, typeEntretien: "Courroies (+3)", cout: 1062.7, notes: "+3 autre(s) élément(s)" },
]

const initialExpenses: Array<{
  date: string
  categorie: "Amende"
  montant: number
  notes: string
}> = [
  { date: "2017-04-11T12:00:00", categorie: "Amende" as const, montant: 17.0, notes: "Contravention" },
  { date: "2017-06-27T12:00:00", categorie: "Amende" as const, montant: 17.0, notes: "Contravention" },
]

export async function seedIfEmpty(): Promise<void> {
  const existing = await db.vehicles.get(VEHICLE_ID)
  if (existing && existing.immatriculation !== PLATE) {
    await db.vehicles.update(VEHICLE_ID, { immatriculation: PLATE })
  }

  // Replace legacy 12-item demo seed (kmInitial === 182162) if present
  const isLegacyDemo = existing?.kmInitial === 182162
  const count = await db.vehicles.count()
  if (count > 0 && !isLegacyDemo) return

  const now = new Date().toISOString()

  const vehicle: Vehicle = {
    id: VEHICLE_ID,
    nom: "Citroën C4",
    marque: "Citroën",
    modele: "C4",
    immatriculation: PLATE,
    kmInitial: 43663,
    kmActuel: 177675,
    carburantDefaut: "Diesel",
    capaciteReservoir: 60,
    createdAt: "2017-02-24T10:00:00.000Z",
  }

  const refuelings: Refueling[] = fills.map((f, i) => ({
    id: `refuel-${String(i + 1).padStart(3, "0")}`,
    vehicleId: VEHICLE_ID,
    date: new Date(f.date + "Z").toISOString(),
    kilometrage: f.km,
    litres: f.litres,
    prixAuLitre: f.prix,
    coutTotal: f.cout,
    carburant: "Diesel",
    pleinComplet: !f.partial,
    station: "",
    notes: "",
    conducteur: "",
    modePaiement: "",
    createdAt: now,
  }))

  const maintenances: Maintenance[] = initialMaintenances.map((m, i) => ({
    id: `maint-${String(i + 1).padStart(2, "0")}`,
    vehicleId: VEHICLE_ID,
    date: new Date(m.date + "Z").toISOString(),
    kilometrage: m.km,
    typeIntervention: "Garage",
    typeEntretien: m.typeEntretien,
    coutTotal: m.cout,
    referencesPieces: "",
    notes: m.notes,
    createdAt: now,
  }))

  const expenses: Expense[] = initialExpenses.map((e, i) => ({
    id: `exp-${String(i + 1).padStart(2, "0")}`,
    vehicleId: VEHICLE_ID,
    date: new Date(e.date + "Z").toISOString(),
    categorie: e.categorie,
    montant: e.montant,
    notes: e.notes,
    createdAt: now,
  }))

  const reminder: Reminder = {
    id: "rem-next-fuel",
    vehicleId: VEHICLE_ID,
    titre: "Plein suivant",
    type: "plein",
    kmEcheance: 178787,
    dateEcheance: "2025-12-03T08:00:00.000Z",
    resolu: false,
    notes: "Estimation basée sur l'autonomie moyenne",
    createdAt: now,
  }

  await db.transaction(
    "rw",
    [db.vehicles, db.refuelings, db.maintenances, db.expenses, db.reminders],
    async () => {
      if (isLegacyDemo) {
        await db.vehicles.clear()
        await db.refuelings.clear()
        await db.maintenances.clear()
        await db.expenses.clear()
        await db.reminders.clear()
      }
      await db.vehicles.put(vehicle)
      await db.refuelings.bulkPut(refuelings)
      await db.maintenances.bulkPut(maintenances)
      await db.expenses.bulkPut(expenses)
      await db.reminders.put(reminder)
    },
  )
}

export { VEHICLE_ID }
