# Board Structures

Discovered 2026-03-19 via Monday.com API.

---

## Profiles (target) — Board ID: `8025265377`

### Writable columns (backfill candidates)

| Column ID | Title | Type |
|---|---|---|
| `text__1` | A Number | text |
| `text2__1` | Date of birth | text |
| `email__1` | E-mail | email |
| `text_mkpwv5fd` | E-mail 2 | text |
| `phone7__1` | Phone | text |
| `text_mkpd32` | Phone 2 | text |
| `physical_address8__1` | Mailing Address | text |
| `text_mkrkrsgj` | Physical Address | text |
| `country_of_birth__1` | Country of Birth | text |
| `e_file__1` | E-File | text |
| `status__1` | Preferred Language | status |
| `people__1` | Attorney | people |
| `case_type__1` | Case Type(s) | dropdown |
| `dms_number_mkkvj2ft` | Case No. | text |
| `consulted_date__1` | Last Consult Date | date |
| `long_text_mksdbeew` | Consultation Notes | long_text |
| `text5__1` | Consult UUID | text |
| `text_mkkvfjrh` | DMS URL | text |
| `dropdown_mm0am7ej` | Pronouns | dropdown |
| `status_mkk94wz2` | Profile Status | status |
| `color_mkzdre4b` | Atty (jail intakes only) | status |
| `text_mkxm5kp3` | PAYMENT LOG | text |
| `text_mkxphk77` | Consult File | text |

### Read-only / mirror columns

| Column ID | Title | Type |
|---|---|---|
| `mirror_mkmxtr7s` | Contract Stage | mirror |
| `lookup_mkrmpjc` | Hire Date | mirror |
| `lookup_mks7nwws` | Last Consult Date | mirror |
| `lookup_mkzenex6` | Mirror | mirror |
| `lookup_mm0h789j` | Mirror 1 | mirror |
| `lookup_mm06p1nv` | CaseTypes | mirror |
| `mirror_mkmneb8r` | Paralegal | mirror |
| `lookup_mksx83wq` | IJ | mirror |
| `lookup_mks0784c` | Receipt Number(s) | mirror |

### Board relations

| Column ID | Title | Type |
|---|---|---|
| `link_to_r__1` | Appointments | board_relation |
| `connect_boards80__1` | Fee Ks | board_relation |
| `board_relation_mkyrp7as` | link to Duplicate of Mail List | board_relation |
| `board_relation_mkyr9c3w` | link to Duplicate of Mail List | board_relation |
| `board_relation_mm0h5h4q` | Call Log | board_relation |
| `connect_boards8__1` | Projects | board_relation |
| `connect_boards82__1` | Activities | board_relation |

### Other columns

| Column ID | Title | Type |
|---|---|---|
| `name` | Name | name |
| `subitems__1` | Subitems | subtasks |
| `button__1` | Create Fee K? | button |
| `company_profile` | Company profile | link |
| `button1__1` | RFE'd? | button |
| `button_1__1` | USCIS/Originals? | button |
| `button5__1` | Address Change? | button |
| `button_Mjj3AbpF` | Appt? | button |
| `button_mkn84prc` | I918B? | button |
| `button_mknfgkhx` | Interview? | button |
| `button_mkncd51f` | Court Case? | button |
| `button_mkta3mat` | Inactive Court Case? | button |
| `button_mkyqqnqa` | Button | button |
| `monday_doc_v2_mkkz1yzr` | monday Doc v2 | direct_doc |
| `files_mkmq860c` | Files | file |
| `doc_mkpndtm9` | Case History | doc |
| `doc_mks14ac3` | Note Sheet | doc |
| `doc_mkzdx089` | Log | doc |
| `pulse_id_mm0p1j9r` | Item ID 1 | item_id |

---

## Appointments R — Board ID: `7788520205`

| Column ID | Title | Type |
|---|---|---|
| `name` | Name | name |
| `status` | Status | status |
| `date3__1` | Consult Date | date |
| `people__1` | Attorney | people |
| `dup__of_first_name2__1` | Alien Number | text |
| `date_of_birth_mkkvs9xh` | Date of Birth | text |
| `country_of_birth__1` | Country of Birth | text |
| `text2` | Phone | text |
| `text` | Email | text |
| `long_text` | Description | long_text |
| `text0__1` | Address | text |
| `status_1__1` | Language | status |
| `item_id__1` | Consult ID | item_id |
| `text2__1` | Consult UUID | text |
| `date_1__1` | Consult Created on | date |
| `status_1_Mjj3Ia2N` | Calendly? | status |
| `text_mkn3jmhc` | Consult SharePoint | text |
| `link_mkk97r86` | E-File | link |

### Board relations

| Column ID | Title | Type |
|---|---|---|
| `connect_boards4__1` | Profiles | board_relation |
| `board_relation_mknzm1as` | link to Profiles | board_relation |
| `link_to_activities_mkm0kx85` | link to Activities | board_relation |
| `link_to_jail_intakes_mkn2ckr3` | Jail Intakes | board_relation |
| `board_relation_mkpk5vwk` | link to Open Forms | board_relation |

### Mirrors

| Column ID | Title | Type |
|---|---|---|
| `lookup_mkzrjg9a` | Create Fee K? | mirror |
| `mirror_mkm0qyvt` | Case Type(s) | mirror |
| `mirror_mkkzsk0v` | Case No. | mirror |
| `mirror_mkm0mdr5` | Projects | mirror |
| `mirror_mkm0e8ca` | Fee Ks | mirror |
| `mirror_mkmn594v` | Paralegal | mirror |
| `lookup_mkp567br` | Mirror | mirror |
| `lookup_mkxpfkxv` | PROFILE ID | mirror |
| `lookup_mkxpznxx` | Consult File | mirror |

---

## Appointments M — Board ID: `8025383981`

| Column ID | Title | Type |
|---|---|---|
| `name` | Name | name |
| `status` | Status | status |
| `date3__1` | Consult Date | date |
| `people__1` | Attorney | people |
| `dup__of_first_name2__1` | Alien Number | text |
| `date_of_birth_mkmqmrv` | Date of Birth | text |
| `country_of_birth__1` | Country of Birth | text |
| `text2` | Phone | text |
| `text` | Email | text |
| `long_text` | Description | long_text |
| `text0__1` | Address | text |
| `status_1__1` | Language | status |
| `item_id__1` | Consult ID | item_id |
| `text2__1` | Consult UUID | text |
| `date_1__1` | Consult Created on | date |
| `status_1_Mjj3Ia2N` | Calendly? | status |
| `text_mkn3gp82` | Consult SharePoint | text |
| `dropdown_mm0anrrq` | Method | dropdown |
| `long_text_mm0af4tz` | M Consult Note | long_text |
| `boolean_mm07zyg1` | CALL REMINDER | checkbox |
| `boolean_mm07cjs3` | DOCS | checkbox |
| `boolean_mm07h8ct` | PAID | checkbox |
| `wf_edit_link_pzmoz` | Submission link | link |
| `link_mm0fyc43` | Zoom Link | link |

### Board relations

| Column ID | Title | Type |
|---|---|---|
| `connect_boards4__1` | Profiles | board_relation |
| `board_relation_mknznp7x` | link to Profiles | board_relation |
| `link_to_activities_mkm033kc` | link to Activities | board_relation |
| `link_to_jail_intakes_mkkgxq4a` | link to Jail Intakes | board_relation |
| `link_to_jail_intakes_mkn2zsy5` | Jail Intakes | board_relation |
| `board_relation_mkpkrjkm` | link to Open Forms | board_relation |

### Mirrors

| Column ID | Title | Type |
|---|---|---|
| `lookup_mkzr8dme` | Create Fee K? | mirror |
| `mirror_mkm0vyty` | Case Type | mirror |
| `mirror_mkm0rr7g` | Case No. | mirror |
| `lookup_mm0aedf8` | Pronouns | mirror |
| `mirror_mkkz5py9` | CLIENT - E-File | mirror |
| `mirror_mkkzgqsx` | Case Type | mirror |
| `mirror_mkm0vggy` | Projects | mirror |
| `mirror_mkm0a3nx` | Fee Ks | mirror |
| `mirror_mkmnh620` | Paralegal | mirror |
| `lookup_mkxpqm68` | PROFILE ID | mirror |
| `lookup_mkxpm30e` | Consult File | mirror |
| `lookup_mm1jxde0` | Mirror | mirror |

---

## Appointments LB — Board ID: `8025389724`

| Column ID | Title | Type |
|---|---|---|
| `name` | Name | name |
| `status` | Status | status |
| `date3__1` | Consult Date | date |
| `people__1` | Attorney | people |
| `dup__of_first_name2__1` | Alien Number | text |
| `date_of_birth_mkmqyeaf` | Date of Birth | text |
| `country_of_birth__1` | Country of Birth | text |
| `text2` | Phone | text |
| `text` | Email | text |
| `text8` | First Name | text |
| `dup__of_first_name__1` | Last Name | text |
| `long_text` | Description | long_text |
| `long_text_mkm6v8x` | Description 2 | long_text |
| `text0__1` | Address | text |
| `status_1__1` | Language | status |
| `item_id__1` | Consult ID | item_id |
| `text2__1` | Consult UUID | text |
| `date_1__1` | Consult Created on | date |
| `status_1_Mjj3Ia2N` | Calendly? | status |
| `text_mkn3br7k` | Consult SharePoint | text |

### Board relations

| Column ID | Title | Type |
|---|---|---|
| `connect_boards4__1` | Profiles | board_relation |
| `board_relation_mknzg600` | link to Profiles | board_relation |
| `link_to_activities_mkm0107k` | link to Activities | board_relation |
| `link_to_jail_intakes_mkkgrtmq` | link to Jail Intakes | board_relation |
| `connect_boards_mkn2e8ct` | Jail Intakes | board_relation |
| `link_to_jail_intakes_mkn2f86p` | link to Jail Intakes | board_relation |
| `board_relation_mkpkpk8c` | link to Open Forms | board_relation |

### Mirrors

| Column ID | Title | Type |
|---|---|---|
| `lookup_mkzrj1k6` | Create Fee K? | mirror |
| `mirror_mkm02yqc` | Case Type(s) | mirror |
| `mirror_mkm0z593` | Case No. | mirror |
| `mirror_mkkzv37t` | E-File | mirror |
| `mirror_mkm0t9re` | Projects | mirror |
| `mirror_mkm08cx8` | Fee Ks | mirror |
| `mirror_mkmnzqy8` | Paralegal | mirror |
| `mirror_mkmq7nm5` | Files (P) | mirror |
| `lookup_mkxp51ds` | PROFILE ID | mirror |
| `lookup_mkxpsapr` | Consult File | mirror |

### Files

| Column ID | Title | Type |
|---|---|---|
| `files_mkmq8htx` | Files NM | file |
| `file_mknrt3bq` | Files | file |

---

## Appointments WH — Board ID: `9283837796`

| Column ID | Title | Type |
|---|---|---|
| `name` | Name | name |
| `status` | Status | status |
| `date3__1` | Consult Date | date |
| `people__1` | Attorney | people |
| `dup__of_first_name2__1` | Alien Number | text |
| `date_of_birth_mkmqyeaf` | Date of Birth | text |
| `country_of_birth__1` | Country of Birth | text |
| `text2` | Phone | text |
| `text` | Email | text |
| `text8` | First Name | text |
| `dup__of_first_name__1` | Last Name | text |
| `long_text` | Description | long_text |
| `long_text_mkm6v8x` | Description 2 | long_text |
| `text0__1` | Address | text |
| `status_1__1` | Language | status |
| `item_id__1` | Consult ID | item_id |
| `text2__1` | Consult UUID | text |
| `date_1__1` | Consult Created on | date |
| `status_1_Mjj3Ia2N` | Calendly? | status |
| `text_mkn3br7k` | Consult SharePoint | text |

### Board relations

| Column ID | Title | Type |
|---|---|---|
| `connect_boards4__1` | Profiles | board_relation |
| `board_relation_mknzg600` | link to Profiles | board_relation |
| `link_to_activities_mkm0107k` | link to Activities | board_relation |
| `link_to_jail_intakes_mkkgrtmq` | link to Jail Intakes | board_relation |
| `connect_boards_mkn2e8ct` | Jail Intakes | board_relation |
| `link_to_jail_intakes_mkn2f86p` | link to Jail Intakes | board_relation |
| `board_relation_mkpkpk8c` | link to Open Forms | board_relation |

### Mirrors

| Column ID | Title | Type |
|---|---|---|
| `lookup_mkzrpk9e` | Create Fee K? | mirror |
| `mirror_mkm02yqc` | Case Type(s) | mirror |
| `mirror_mkm0z593` | Case No. | mirror |
| `mirror_mkkzv37t` | E-File | mirror |
| `mirror_mkm0t9re` | Projects | mirror |
| `mirror_mkm08cx8` | Fee Ks | mirror |
| `mirror_mkmnzqy8` | Paralegal | mirror |
| `mirror_mkmq7nm5` | Files (P) | mirror |
| `lookup_mkxprvz3` | PROFILE ID | mirror |
| `lookup_mkxpqyad` | Consult File | mirror |
| `lookup_mkybdw09` | Jail intake ID | mirror |
| `doc_mkxfqxq6` | Intake Sheet | doc |

### Files

| Column ID | Title | Type |
|---|---|---|
| `files_mkmq8htx` | Files NM | file |
| `file_mknrt3bq` | Files | file |

---

## Cross-Board Field Mapping (Source → Target)

Common writable fields across all appointment boards that map to Profiles:

| Field | Profiles (target) | Appt R | Appt M | Appt LB | Appt WH |
|---|---|---|---|---|---|
| A Number | `text__1` | `dup__of_first_name2__1` | `dup__of_first_name2__1` | `dup__of_first_name2__1` | `dup__of_first_name2__1` |
| Date of Birth | `text2__1` | `date_of_birth_mkkvs9xh` | `date_of_birth_mkmqmrv` | `date_of_birth_mkmqyeaf` | `date_of_birth_mkmqyeaf` |
| Country of Birth | `country_of_birth__1` | `country_of_birth__1` | `country_of_birth__1` | `country_of_birth__1` | `country_of_birth__1` |
| Phone | `phone7__1` | `text2` | `text2` | `text2` | `text2` |
| Email | `email__1` | `text` | `text` | `text` | `text` |
| Address | `physical_address8__1` | `text0__1` | `text0__1` | `text0__1` | `text0__1` |
| Language | `status__1` | `status_1__1` | `status_1__1` | `status_1__1` | `status_1__1` |
| Attorney | `people__1` | `people__1` | `people__1` | `people__1` | `people__1` |
| Consult Date | `consulted_date__1` | `date3__1` | `date3__1` | `date3__1` | `date3__1` |
| Description | `long_text_mksdbeew` | `long_text` | `long_text` | `long_text` | `long_text` |

### Matching strategy

Each appointment board has a **link to Profiles** board_relation column:

| Board | Column ID |
|---|---|
| Appointments R | `board_relation_mknzm1as` |
| Appointments M | `board_relation_mknznp7x` |
| Appointments LB | `board_relation_mknzg600` |
| Appointments WH | `board_relation_mknzg600` |
