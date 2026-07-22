// assetService.js
//
// Single source of truth for asset/tender data used by both BrowseAssetsPage
// (the list) and AssetDetailPage (the per-lot blueprint). Keeping them in
// sync off one array means whatever id a card links to on the list page will
// always resolve to the matching lot on the detail page.
//
// Replace ASSETS with a real API call (e.g. GET /Asset or GET /Tender) when
// the backend endpoint exists — getAssetById and getAllAssets are the two
// functions the pages depend on, so swapping the implementation underneath
// them won't require touching BrowseAssetsPage.js or AssetDetailPage.js.

export const ASSETS = [
  {
    id: "1",
    barcode: "NMU-VEH-0001-A",
    status: "Active",
    statusClass: "status-active",
    category: "VEHICLES - SEDANS",
    title: "2019 Toyota Corolla 1.6 Quest",
    description:
      "Ex-fleet vehicle in good condition. Full service history available. Mileage: 145,000km.",
    department: "Campus Fleet Services",
    conditionGrade: "Grade B - Good",
    leadingBid: 85000,
    recommendedBid: 88000,
    auctionEndsInHours: 48,
    image: null,
  },
  {
    id: "2",
    barcode: "NMU-SCI-0002-A",
    status: "Active",
    statusClass: "status-active",
    category: "SCIENTIFIC",
    title: "Olympus CX23 Upright Microscope",
    description:
      "Binocular microscope used in undergraduate biology labs. Fully functional, minor cosmetic wear.",
    department: "Health Sciences",
    conditionGrade: "Grade A - Excellent",
    leadingBid: 14500,
    recommendedBid: 15200,
    auctionEndsInHours: 62,
    image: null,
  },
  {
    id: "3",
    barcode: "NMU-IT-0003-A",
    status: "Closing in 2h",
    statusClass: "status-urgent",
    category: "IT INFRASTRUCTURE",
    title: "Dell PowerEdge R740 Server Batch",
    description:
      "Lot of 3 decommissioned servers. No HDDs included. RAM and CPUs intact. Sold as a single lot.",
    department: "IT Services",
    conditionGrade: "Grade C - Fair",
    leadingBid: 22000,
    recommendedBid: 23500,
    auctionEndsInHours: 2,
    image: null,
  },
  {
    id: "4",
    barcode: "NMU-VEH-0004-A",
    status: "Active",
    statusClass: "status-active",
    category: "VEHICLES - UTILITY",
    title: "2018 Isuzu D-Max 250 Single Cab",
    description:
      "Campus maintenance vehicle. Canopy included. Runs perfectly, shows typical work-related wear.",
    department: "Campus Maintenance",
    conditionGrade: "Grade B - Good",
    leadingBid: 115000,
    recommendedBid: 118000,
    auctionEndsInHours: 96,
    image: null,
  },
];

export function getAllAssets() {
  return ASSETS;
}

export function getAssetById(id) {
  return ASSETS.find((asset) => String(asset.id) === String(id)) || null;
}