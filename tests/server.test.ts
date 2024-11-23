import { FastifyInstance } from "fastify";
import { describe, it, expect } from "@jest/globals";
import { v4 as uuidv4 } from "uuid";
import { build, getPointsBreakdown, Receipt } from "../src/app";

describe("receipt-processor-api", () => {
  let fastify: FastifyInstance;

  beforeAll(() => {
    fastify = build();
  });

  afterAll(() => {
    fastify.close();
  });

  describe("GET /health", () => {
    it("should return status ok", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/health",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: "ok" });
    });
  });

  describe("POST /receipts/process", () => {
    it("should return the id", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/receipts/process",
        body: {
          retailer: "Target",
          purchaseDate: "2022-01-02",
          purchaseTime: "13:01",
          total: "6.49",
          items: [],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ id: expect.any(String) });
    });

    it("should return 400 for invalid receipt", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/receipts/process",
        body: {
          retailer: "Target",
          purchaseDate: "2022-01-02",
          purchaseTime: "13:0",
          total: "6.49",
          items: [],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 400 for negative dollar amount", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/receipts/process",
        body: {
          retailer: "Target",
          purchaseDate: "2022-01-02",
          purchaseTime: "13:01",
          total: "-1.00",
          items: [],
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("GET /receipts/:id/points", () => {
    it("should return a 400 for invalid id", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/receipts/123/points",
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return a 404 if the receipt is not found", async () => {
      const id = uuidv4();
      const response = await fastify.inject({
        method: "GET",
        url: `/receipts/${id}/points`,
      });

      expect(response.statusCode).toBe(404);
    });

    it("should return points", async () => {
      const receipt: Receipt = {
        retailer: "Target",
        purchaseDate: "2022-01-02",
        purchaseTime: "13:01",
        total: "6.49",
        items: [],
      };

      const processResponse = await fastify.inject({
        method: "POST",
        url: "/receipts/process",
        payload: receipt,
      });

      const { id } = processResponse.json();

      const pointsResponse = await fastify.inject({
        method: "GET",
        url: `/receipts/${id}/points`,
      });

      expect(pointsResponse.statusCode).toBe(200);
      expect(pointsResponse.json()).toEqual({ points: 6 });
    });
  });

  describe("calculatePoints", () => {
    it("should return 0 points for non-alphanumeric in the retailer name", () => {
      const receipt: Receipt = {
        retailer: "!!!!",
        purchaseDate: "2022-01-02",
        purchaseTime: "13:01",
        total: "6.49",
        items: [],
      };

      const pointsBreakdown = getPointsBreakdown(receipt);

      expect(pointsBreakdown.alphaNumericPoints).toBe(0);
    });

    it("should return 4 point for a single numeric characters in the retailer name", () => {
      const receipt: Receipt = {
        retailer: "1234",
        purchaseDate: "2022-01-02",
        purchaseTime: "13:01",
        total: "6.49",
        items: [],
      };

      const pointsBreakdown = getPointsBreakdown(receipt);

      expect(pointsBreakdown.alphaNumericPoints).toBe(4);
    });

    it("should return points for retailer name with spaces in front of and behind name", () => {
      const receipt: Receipt = {
        retailer: "   Target   ",
        purchaseDate: "2022-01-02",
        purchaseTime: "13:01",
        total: "6.49",
        items: [],
      };

      const pointsBreakdown = getPointsBreakdown(receipt);

      expect(pointsBreakdown.alphaNumericPoints).toBe(6);
    });

    it("should return 1 point for every alphanumeric character in the retailer name", () => {
      const receipt: Receipt = {
        retailer: "Target",
        purchaseDate: "2022-01-02",
        purchaseTime: "13:01",
        total: "6.49",
        items: [],
      };

      const pointsBreakdown = getPointsBreakdown(receipt);

      expect(pointsBreakdown.alphaNumericPoints).toBe(6);
    });

    it("should return 0 points for 0 dollar amount", () => {
      const receipt: Receipt = {
        retailer: "Target",
        purchaseDate: "2022-01-02",
        purchaseTime: "13:01",
        total: "0.00",
        items: [],
      };

      const pointsBreakdown = getPointsBreakdown(receipt);

      expect(pointsBreakdown.roundDollarPoints).toBe(0);
    });

    it("should add 50 points for a round dollar amount with no cents", () => {
      const receipt: Receipt = {
        retailer: "Target",
        purchaseDate: "2022-01-02",
        purchaseTime: "13:01",
        total: "10.00",
        items: [],
      };

      const pointsBreakdown = getPointsBreakdown(receipt);

      expect(pointsBreakdown.roundDollarPoints).toBe(50);
    });

    it("should add 25 points for fractional total of 0.25", () => {
      const receipt: Receipt = {
        retailer: "Target",
        purchaseDate: "2022-01-02",
        purchaseTime: "13:01",
        total: "0.25",
        items: [],
      };

      const pointsBreakdown = getPointsBreakdown(receipt);

      expect(pointsBreakdown.multipleOfTwentyFiveCentsPoints).toBe(25);
    });

    it("should not add 25 points for total of 0", () => {
      const receipt: Receipt = {
        retailer: "Target",
        purchaseDate: "2022-01-02",
        purchaseTime: "13:01",
        total: "0.00",
        items: [],
      };

      const pointsBreakdown = getPointsBreakdown(receipt);

      expect(pointsBreakdown.multipleOfTwentyFiveCentsPoints).toBe(0);
    });

    it("should add 25 points for a total that is a multiple of 0.25", () => {
      const receipt: Receipt = {
        retailer: "Target",
        purchaseDate: "2022-01-02",
        purchaseTime: "13:01",
        total: "10.25",
        items: [],
      };

      const pointsBreakdown = getPointsBreakdown(receipt);

      expect(pointsBreakdown.multipleOfTwentyFiveCentsPoints).toBe(25);
    });

    it("should add 5 points for every two items on the receipt", () => {
      const receipt: Receipt = {
        retailer: "Target",
        purchaseDate: "2022-01-02",
        purchaseTime: "13:01",
        total: "10.25",
        items: [
          { shortDescription: "Mountain Dew 12PK", price: "6.49" },
          { shortDescription: "Mountain Dew 12PK", price: "6.49" },
          { shortDescription: "Mountain Dew 12PK", price: "6.49" },
        ],
      };

      const pointsBreakdown = getPointsBreakdown(receipt);

      expect(pointsBreakdown.itemPoints).toBe(5);
    });

    it("should add 10 points for four items on the receipt", () => {
      const receipt: Receipt = {
        retailer: "Target",
        purchaseDate: "2022-01-02",
        purchaseTime: "13:01",
        total: "10.25",
        items: [
          { shortDescription: "Mountain Dew", price: "6.49" },
          { shortDescription: "Mountain Dew", price: "6.49" },
          { shortDescription: "Mountain Dew", price: "6.49" },
          { shortDescription: "Mountain Dew", price: "6.49" },
        ],
      };

      const pointsBreakdown = getPointsBreakdown(receipt);

      expect(pointsBreakdown.itemPoints).toBe(10);
    });

    it("should add points based on item description length", () => {
      const receipt: Receipt = {
        retailer: "Target",
        purchaseDate: "2022-01-02",
        purchaseTime: "13:01",
        total: "10.25",
        items: [{ shortDescription: "Mountain Dew", price: "6.49" }],
      };

      const pointsBreakdown = getPointsBreakdown(receipt);

      expect(pointsBreakdown.trimmedLengthPoints).toBe(2);
    });

    it("should not add points for item without description", () => {
      const receipt: Receipt = {
        retailer: "Target",
        purchaseDate: "2022-01-02",
        purchaseTime: "13:01",
        total: "10.25",
        items: [{ shortDescription: "", price: "6.49" }],
      };

      const pointsBreakdown = getPointsBreakdown(receipt);

      expect(pointsBreakdown.trimmedLengthPoints).toBe(0);
    });

    it("should add 6 points if the day in the purchase date is odd", () => {
      const receipt: Receipt = {
        retailer: "Target",
        purchaseDate: "2022-01-01",
        purchaseTime: "13:01",
        total: "10.25",
        items: [],
      };

      const pointsBreakdown = getPointsBreakdown(receipt);

      expect(pointsBreakdown.oddDayPoints).toBe(6);
    });

    it("should not add points if the purchaseDate is invalid", () => {
      const receipt: Receipt = {
        retailer: "Target",
        purchaseDate: "invalid",
        purchaseTime: "13:01",
        total: "10.25",
        items: [],
      };

      const pointsBreakdown = getPointsBreakdown(receipt);

      expect(pointsBreakdown.oddDayPoints).toBe(0);
    });

    it("should add 10 points if the time of purchase is after 2:00pm and before 4:00pm", () => {
      const receipt: Receipt = {
        retailer: "Target",
        purchaseDate: "2022-01-02",
        purchaseTime: "14:59",
        total: "10.25",
        items: [],
      };

      const pointsBreakdown = getPointsBreakdown(receipt);

      expect(pointsBreakdown.timeOfPurchasePoints).toBe(10);
    });

    it("should not add 10 points if the time is at exactly 2:00pm", () => {
      const receipt: Receipt = {
        retailer: "Target",
        purchaseDate: "2022-01-02",
        purchaseTime: "14:00",
        total: "10.25",
        items: [],
      };

      const pointsBreakdown = getPointsBreakdown(receipt);

      expect(pointsBreakdown.timeOfPurchasePoints).toBe(0);
    });

    it("should not add 10 points if the time is at exactly 4:00pm", () => {
      const receipt: Receipt = {
        retailer: "Target",
        purchaseDate: "2022-01-02",
        purchaseTime: "16:00",
        total: "10.25",
        items: [],
      };

      const pointsBreakdown = getPointsBreakdown(receipt);

      expect(pointsBreakdown.timeOfPurchasePoints).toBe(0);
    });

    it("should return correct points for example 1", async () => {
      const receipt: Receipt = {
        retailer: "Target",
        purchaseDate: "2022-01-01",
        purchaseTime: "13:01",
        items: [
          {
            shortDescription: "Mountain Dew 12PK",
            price: "6.49",
          },
          {
            shortDescription: "Emils Cheese Pizza",
            price: "12.25",
          },
          {
            shortDescription: "Knorr Creamy Chicken",
            price: "1.26",
          },
          {
            shortDescription: "Doritos Nacho Cheese",
            price: "3.35",
          },
          {
            shortDescription: "   Klarbrunn 12-PK 12 FL OZ  ",
            price: "12.00",
          },
        ],
        total: "35.35",
      };

      const pointsBreakdown = getPointsBreakdown(receipt);

      expect(pointsBreakdown.alphaNumericPoints).toBe(6);
      expect(pointsBreakdown.itemPoints).toBe(10);
      expect(pointsBreakdown.trimmedLengthPoints).toBe(6);
      expect(pointsBreakdown.oddDayPoints).toBe(6);
      expect(pointsBreakdown.totalPoints).toBe(28);
    });

    it("should return correct points for example 2", async () => {
      const receipt: Receipt = {
        retailer: "M&M Corner Market",
        purchaseDate: "2022-03-20",
        purchaseTime: "14:33",
        items: [
          {
            shortDescription: "Gatorade",
            price: "2.25",
          },
          {
            shortDescription: "Gatorade",
            price: "2.25",
          },
          {
            shortDescription: "Gatorade",
            price: "2.25",
          },
          {
            shortDescription: "Gatorade",
            price: "2.25",
          },
        ],
        total: "9.00",
      };

      const pointsBreakdown = getPointsBreakdown(receipt);

      expect(pointsBreakdown.roundDollarPoints).toBe(50);
      expect(pointsBreakdown.multipleOfTwentyFiveCentsPoints).toBe(25);
      expect(pointsBreakdown.alphaNumericPoints).toBe(14);
      expect(pointsBreakdown.timeOfPurchasePoints).toBe(10);
      expect(pointsBreakdown.itemPoints).toBe(10);
      expect(pointsBreakdown.totalPoints).toBe(109);
    });
  });
});
