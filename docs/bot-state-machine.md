1️⃣ State lista

START
ASK_SERVICE
ASK_LOCATION
ASK_DESCRIPTION
ASK_CONTACT
CONFIRM_REQUEST
END

2️⃣ Session podaci

session = {
state: "ASK_SERVICE",
service: null,
location: null,
description: null,
contact: null
}

3️⃣ Pravila prelaza (transition logic)

START → ASK_SERVICE

ASK_SERVICE
ako je servis prepoznat → ASK_LOCATION
ako nije → ASK_SERVICE

ASK_LOCATION
ako je lokacija prepoznata → ASK_DESCRIPTION
ako nije → ASK_LOCATION

ASK_DESCRIPTION
ako opis postoji → ASK_CONTACT

ASK_CONTACT
ako kontakt postoji → CONFIRM_REQUEST

CONFIRM_REQUEST
ako korisnik potvrdi → END
ako ne → ASK_SERVICE
