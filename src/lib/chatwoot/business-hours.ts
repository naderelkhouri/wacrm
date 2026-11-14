// ============================================================
// Business Hours & Holiday Scheduler
// Adapted from @chatwoot/business-hours (MIT License)
// ============================================================

export interface WorkingShift {
  start: string; // "HH:mm"
  end: string;   // "HH:mm"
}

export type WeeklySchedule = {
  [dayOfWeek: number]: WorkingShift[] | null;
};

export interface BusinessHoursConfig {
  hours: WeeklySchedule;
  holidays?: Date[];
}

export const DEFAULT_BR_BUSINESS_HOURS: WeeklySchedule = {
  0: null, // Domingo
  1: [
    { start: '09:00', end: '12:00' },
    { start: '13:00', end: '18:00' },
  ],
  2: [
    { start: '09:00', end: '12:00' },
    { start: '13:00', end: '18:00' },
  ],
  3: [
    { start: '09:00', end: '12:00' },
    { start: '13:00', end: '18:00' },
  ],
  4: [
    { start: '09:00', end: '12:00' },
    { start: '13:00', end: '18:00' },
  ],
  5: [
    { start: '09:00', end: '12:00' },
    { start: '13:00', end: '18:00' },
  ],
  6: null, // Sábado
};

function getBoundaries(start: string, end: string, date: Date): [Date, Date] {
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);

  const startTime = new Date(date);
  startTime.setHours(startHour, startMinute, 0, 0);

  const endTime = new Date(date);
  endTime.setHours(endHour, endMinute, 0, 0);

  return [startTime, endTime];
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

export class BusinessHoursScheduler {
  private hours: WeeklySchedule;
  private holidays: Date[];

  constructor(config?: Partial<BusinessHoursConfig>) {
    this.hours = config?.hours ?? DEFAULT_BR_BUSINESS_HOURS;
    this.holidays = config?.holidays ?? [];
  }

  public isHoliday(date: Date): boolean {
    const dateOnly = date.toDateString();
    return this.holidays.some((holiday) => holiday.toDateString() === dateOnly);
  }

  public isWorkingDay(date: Date): boolean {
    if (this.isHoliday(date)) return false;
    const workingHours = this.getWorkingHours(date);
    return workingHours !== null && workingHours.length > 0;
  }

  public isWorkingTime(date: Date = new Date()): boolean {
    if (!this.isWorkingDay(date)) return false;

    const workingHours = this.getWorkingHours(date);
    if (workingHours) {
      for (const { start, end } of workingHours) {
        const [startTime, endTime] = getBoundaries(start, end, date);
        if (date >= startTime && date <= endTime) {
          return true;
        }
      }
    }
    return false;
  }

  public nextWorkingDay(date: Date = new Date()): Date {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    while (!this.isWorkingDay(nextDay)) {
      nextDay.setDate(nextDay.getDate() + 1);
    }
    return nextDay;
  }

  public nextWorkingTime(date: Date = new Date()): Date {
    const current = new Date(date);
    if (this.isWorkingTime(current)) {
      return current;
    }

    // Check if there is still an upcoming shift later today
    if (this.isWorkingDay(current)) {
      const todayShifts = this.getWorkingHours(current) || [];
      for (const { start } of todayShifts) {
        const [startTime] = getBoundaries(start, start, current);
        if (startTime > current) {
          return startTime;
        }
      }
    }

    // Move to first shift of next working day
    const nextDay = this.nextWorkingDay(current);
    const workingHours = this.hours[nextDay.getDay()];
    if (workingHours && workingHours.length > 0) {
      const [startHour, startMinute] = workingHours[0].start.split(':').map(Number);
      nextDay.setHours(startHour, startMinute, 0, 0);
    }
    return nextDay;
  }

  public getRemainingWorkingTime(date: Date = new Date()): number {
    const workingHours = this.getWorkingHours(date);
    if (workingHours) {
      for (const { start, end } of workingHours) {
        const [startTime, endTime] = getBoundaries(start, end, date);
        if (date >= startTime && date < endTime) {
          return Math.floor((endTime.getTime() - date.getTime()) / 1000);
        }
      }
    }
    return 0;
  }

  public addWorkingSeconds(date: Date, seconds: number): Date {
    let newDate = this.nextWorkingTime(new Date(date));
    let remainingSeconds = seconds;

    while (remainingSeconds > 0) {
      const currentShiftRemaining = this.getRemainingWorkingTime(newDate);
      if (currentShiftRemaining <= 0) {
        newDate = this.nextWorkingTime(addSeconds(newDate, 60));
        continue;
      }

      if (remainingSeconds <= currentShiftRemaining) {
        newDate = addSeconds(newDate, remainingSeconds);
        remainingSeconds = 0;
      } else {
        remainingSeconds -= currentShiftRemaining;
        newDate = this.nextWorkingTime(addSeconds(newDate, currentShiftRemaining + 60));
      }
    }

    return newDate;
  }

  private getWorkingHours(date: Date): WorkingShift[] | null {
    return this.hours[date.getDay()] ?? null;
  }
}
