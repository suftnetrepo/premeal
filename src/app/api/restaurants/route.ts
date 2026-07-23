import { NextResponse } from "next/server";
import { getListableRestaurants } from "@/lib/restaurant-listing";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");

  const lat = latParam ? parseFloat(latParam) : null;
  const lng = lngParam ? parseFloat(lngParam) : null;
  const location = lat !== null && lng !== null && !Number.isNaN(lat) && !Number.isNaN(lng) ? { lat, lng } : undefined;

  const restaurants = await getListableRestaurants(location);
  return NextResponse.json({ restaurants });
}
