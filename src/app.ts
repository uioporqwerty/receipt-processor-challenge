import fastify from "fastify";
import { v4 as uuidv4 } from "uuid";
import { parseISO } from "date-fns";

export interface Receipt {
  retailer: string;
  purchaseDate: string;
  purchaseTime: string;
  total: string;
  items: {
    shortDescription: string;
    price: string;
  }[];
}

export function build(opts = {}) {
  const app = fastify(opts);
  const receiptPoints: Record<string, number> = {};

  app.get("/health", async () => {
    return { status: "ok" };
  });

  app.post<{
    Body: Receipt;
  }>("/receipts/process", async (request, reply): Promise<{ id: string }> => {
    const payload = request.body;
    const id = uuidv4();

    receiptPoints[id] = getPointsBreakdown(payload).totalPoints;

    return { id };
  });

  app.get<{
    Params: { id: string };
  }>("/receipts/:id/points", async (request, reply) => {
    const { id } = request.params;

    if (!receiptPoints[id]) {
      reply.status(404);
      return;
    }

    return { points: receiptPoints[id] };
  });
  return app;
}

export function getPointsBreakdown(receipt: Receipt): {
  alphaNumericPoints: number;
  roundDollarPoints: number;
  multipleOfTwentyFiveCentsPoints: number;
  itemPoints: number;
  trimmedLengthPoints: number;
  oddDayPoints: number;
  timeOfPurchasePoints: number;
  totalPoints: number;
} {
  // One point for every alphanumeric character in the retailer name.
  let alphaNumericPoints = 0;
  for (const char of receipt.retailer) {
    if (char.match(/[a-zA-Z0-9]/)) {
      alphaNumericPoints += 1;
    }
  }

  // 50 points if the total is a round dollar amount with no cents.
  let roundDollarPoints = 0;
  const receiptTotal = parseFloat(receipt.total);
  if (receiptTotal % 1 === 0) {
    roundDollarPoints += 50;
  }

  // 25 points if the total is a multiple of `0.25`.
  let multipleOfTwentyFiveCentsPoints = 0;
  if (receiptTotal % 0.25 === 0) {
    multipleOfTwentyFiveCentsPoints += 25;
  }

  // 5 points for every two items on the receipt.
  let itemPoints = 0;
  itemPoints = Math.floor(receipt.items.length / 2) * 5;

  // If the trimmed length of the item description is a multiple of 3, multiply the price by `0.2` and round up to the nearest integer. The result is the number of points earned.
  let trimmedLengthPoints = 0;
  for (const item of receipt.items) {
    const trimmedLength = item.shortDescription.trim().length;
    if (trimmedLength % 3 === 0) {
      trimmedLengthPoints += Math.ceil(parseFloat(item.price) * 0.2);
    }
  }

  // 6 points if the day in the purchase date is odd.
  let oddDayPoints = 0;
  const purchaseDate = parseISO(receipt.purchaseDate);
  if (purchaseDate.getDate() % 2 === 1) {
    oddDayPoints += 6;
  }

  // 10 points if the time of purchase is after 2:00pm and before 4:00pm.
  let timeOfPurchasePoints = 0;
  const [hours, minutes] = receipt.purchaseTime.split(":").map(Number);
  if (hours === 14 || (hours === 15 && minutes < 60)) {
    timeOfPurchasePoints += 10;
  }

  const totalPoints =
    alphaNumericPoints +
    roundDollarPoints +
    multipleOfTwentyFiveCentsPoints +
    itemPoints +
    trimmedLengthPoints +
    oddDayPoints +
    timeOfPurchasePoints;

  return {
    alphaNumericPoints,
    roundDollarPoints,
    multipleOfTwentyFiveCentsPoints,
    itemPoints,
    trimmedLengthPoints,
    oddDayPoints,
    timeOfPurchasePoints,
    totalPoints,
  };
}
