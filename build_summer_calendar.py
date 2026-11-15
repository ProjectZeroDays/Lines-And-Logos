import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

wb = openpyxl.Workbook()
thin = Side(style="thin", color="BFBFBF")
BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)
HDR_FILL = PatternFill("solid", fgColor="C55A11")
INPUT_FILL = PatternFill("solid", fgColor="FFF2CC")
INPUT_FONT = Font(color="0000FF", size=10)
CALC_FILL = PatternFill("solid", fgColor="DDEBF7")
BOLD = Font(bold=True, size=10, color="FFFFFF")
TITLE = Font(bold=True, size=14, color="C55A11")
ITALIC = Font(size=9, italic=True, color="808080")

# ---------- Sheet 1: Capacity Planner ----------
ws = wb.active
ws.title = "Capacity_Planner"
ws["A1"] = "Summer Install Capacity Planner (May-Aug) - Lines & Logos"
ws["A1"].font = TITLE
ws.merge_cells("A1:H1")
ws["A2"] = "Enter project durations in crew-days. Total crew-days per month must not exceed available capacity. Adjust available crew-days in yellow."
ws["A2"].font = ITALIC
ws.merge_cells("A2:H2")

headers = ["Project","Client","Type","Start","End","Crew-Days","Crew","Status"]
for c, h in enumerate(headers, start=1):
    cell = ws.cell(row=4, column=c, value=h); cell.font = BOLD; cell.fill = HDR_FILL; cell.border = BORDER
    cell.alignment = Alignment(horizontal="center", wrap_text=True)

# sample rows
sample = [
 ("MSCS - Northeast Prep gym refresh","Memphis-Shelby County Schools","Gym Refresh","2026-06-01","2026-06-05",5,"Crew A","Quoted"),
 ("Bartlett HS floor + logo","Bartlett City Schools","Gym Refresh","2026-06-08","2026-06-12",5,"Crew A","Quoted"),
 ("Bellevue donor wall + wraps","Bellevue Baptist Church","Campus Branding","2026-06-15","2026-06-26",10,"Crew B","Prospect"),
 ("DeSoto - 2 campus gym refresh","DeSoto County Schools","Gym Refresh","2026-07-06","2026-07-17",10,"Crew A","Prospect"),
 ("Collierville full facility","Collierville Schools","Full Facility","2026-07-20","2026-08-14",20,"Crew A+B","Prospect"),
]
r = 5
first = r
for row in sample:
    for c, v in enumerate(row, start=1):
        cell = ws.cell(row=r, column=c, value=v)
        cell.border = BORDER; cell.font = Font(size=10)
        if c in (6,): cell.fill = INPUT_FILL; cell.font = INPUT_FONT; cell.alignment = Alignment(horizontal="center")
        if c in (4,5): cell.alignment = Alignment(horizontal="center")
    r += 1
last = r - 1

# 20 blank rows for user entry
for rr in range(r, r+20):
    for c in range(1,9):
        ws.cell(row=rr, column=c).border = BORDER
    for c in (6,):
        ws.cell(row=rr, column=c).fill = INPUT_FILL

# capacity summary block
sr = r + 22
ws.cell(row=sr, column=1, value="Monthly Capacity Summary").font = TITLE
hdr = ["Month","Available Crew-Days","Booked Crew-Days","Remaining","Utilization"]
for c, h in enumerate(hdr, start=1):
    cell = ws.cell(row=sr+1, column=c, value=h); cell.font = BOLD; cell.fill = HDR_FILL; cell.border = BORDER
    cell.alignment = Alignment(horizontal="center")
months = [("May 2026",5,0),("Jun 2026",20,0),("Jul 2026",20,0),("Aug 2026",20,0)]
rr = sr + 2
for m, cap, booked in months:
    ws.cell(row=rr, column=1, value=m).border = BORDER
    c = ws.cell(row=rr, column=2, value=cap); c.fill = INPUT_FILL; c.font = INPUT_FONT; c.alignment = Alignment(horizontal="center"); c.border = BORDER
    ws.cell(row=rr, column=3, value=f'=SUMIFS($F$5:$F${last+20},$D$5:$D${last+20},">="&DATE({m[:4]},{["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].index(m[0:3])+1},1), $D$5:$D${last+20},"<"&DATE({m[:4]},{["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].index(m[0:3])+2},1))').number_format = "0"
    ws.cell(row=rr, column=3).fill = CALC_FILL; ws.cell(row=rr, column=3).border = BORDER; ws.cell(row=rr, column=3).alignment = Alignment(horizontal="center")
    ws.cell(row=rr, column=4, value=f"=B{rr}-C{rr}").number_format = "0"
    ws.cell(row=rr, column=4).fill = CALC_FILL; ws.cell(row=rr, column=4).border = BORDER; ws.cell(row=rr, column=4).alignment = Alignment(horizontal="center")
    ws.cell(row=rr, column=5, value=f"=IF(B{rr}=0,0,C{rr}/B{rr})").number_format = "0.0%"
    ws.cell(row=rr, column=5).fill = CALC_FILL; ws.cell(row=rr, column=5).border = BORDER; ws.cell(row=rr, column=5).alignment = Alignment(horizontal="center")
    rr += 1

ws.cell(row=rr+1, column=1, value="Note: SUMIFS uses start date (col D) to bucket crew-days into months. Adjust available crew-days (col B) for holidays, weather, or crew size.").font = ITALIC
ws.cell(row=rr+1, column=1).alignment = Alignment(wrap_text=True)
ws.merge_cells(start_row=rr+1, start_column=1, end_row=rr+1, end_column=5)

for i, w in enumerate([34,26,12,12,10,11,10,12], start=1):
    ws.column_dimensions[get_column_letter(i)].width = w
ws.freeze_panes = "A5"

# ---------- Sheet 2: Booking Rules ----------
w2 = wb.create_sheet("Booking_Rules")
w2["A1"] = "Summer Booking Rules & Capacity Guidelines"
w2["A1"].font = TITLE
rules = [
 ("Rule","Detail"),
 ("Peak window","May 15 - Aug 15 (schools out; gyms available)"),
 ("Crew capacity","1 crew = ~20 crew-days/month (5-day weeks, 4 weeks, minus holidays/weather)"),
 ("2-crew capacity","~40 crew-days/month when both crews run in parallel"),
 ("Booking cutoff","Hold slots through April; release unbooked slots May 1"),
 ("Premium","Summer installs (Jun-Aug) carry 15% premium (demand window)"),
 ("Off-season","Sep-May: maintenance, smaller projects, indoor work, sales"),
 ("Downtime","Gym out of use 1-2 days (screen & recoat) or 5-7 days (full sand & refinish)"),
 ("Weather buffer","Reserve 2-3 crew-days/month for rain delays on outdoor work"),
 ("Priority","Tier A accounts first; then Tier B; Tier C fills gaps"),
]
r=3
for h in rules[0]:
    c=w2.cell(row=r,column=rules[0].index(h)+1,value=h); c.font=BOLD; c.fill=HDR_FILL; c.border=BORDER
r=4
for row in rules[1:]:
    for i,v in enumerate(row,start=1):
        cell=w2.cell(row=r,column=i,value=v); cell.border=BORDER; cell.font=Font(size=10)
        cell.alignment=Alignment(vertical="top",wrap_text=True)
    r+=1
w2.column_dimensions["A"].width=24
w2.column_dimensions["B"].width=90

wb.save("Summer_Install_Calendar.xlsx")
print("saved Summer_Install_Calendar.xlsx")
