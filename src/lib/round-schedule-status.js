const ROUND_SCHEDULE_STATUS = {
    confirmed: '☑️ Confirmed Schedule',
    provisional: '⏳ Provisional Schedule',
    estimated: '⏳ Estimated Schedule',
};

const event_schedule_status = (event) => {
    const rounds = Array.isArray(event?.rounds) ? event.rounds : [];
    let numNonQualificationRounds = 0;

    for (const round of rounds) {
        if (round.kind === 'qualification') {
            continue;
        }

        numNonQualificationRounds += 1;

        if (round.schedule_status === 'provisional') {
            return ROUND_SCHEDULE_STATUS.provisional;
        }

        if (round.schedule_status === 'estimated') {
            return ROUND_SCHEDULE_STATUS.estimated;
        }
    }

    return numNonQualificationRounds > 0 ? ROUND_SCHEDULE_STATUS.confirmed : ROUND_SCHEDULE_STATUS.provisional;
};

export { event_schedule_status };
