import type { Client } from "discord.js";
import { startDailyQuestion } from "./dailyQuestion";
import { startCoffeeRoulette } from "./coffeeRoulette";
import { startInactivityReminder } from "./inactivityReminder";

export function startAllCronJobs(client: Client): void {
  startDailyQuestion(client);
  startCoffeeRoulette(client);
  startInactivityReminder(client);
}
