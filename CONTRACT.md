## GetCurrentStatus(UserID):Result<Status, GetStatusError>
Success Example: {ok: true, value: Attending}
Failing Example: {ok:false, error: new InvalidStatusError("Status invalid")}

## Toggle(UserID, EventID):Result<Status, RVSPError>
Success Example: {ok:true, value:Waitlist}
Failing Example: {ok:false, error: new InvalidUserError("User doesn't exist for event cancelling")}

## Search(EventName):Result<Event[], SearchError>
Success Example: {ok: true, value: [Event1, Event2]}
Failing Example: {ok: false, error: new NetworkError("The system failed to search. Try again")}