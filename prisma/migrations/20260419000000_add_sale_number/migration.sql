-- CreateSequence starting at 1000 so credit numbers are short and readable
CREATE SEQUENCE "Sale_saleNumber_seq" START WITH 1000 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

-- AddColumn with sequence as default (existing rows will each get a unique number >= 1000)
ALTER TABLE "Sale" ADD COLUMN "saleNumber" INTEGER NOT NULL DEFAULT nextval('"Sale_saleNumber_seq"');

-- Tie the sequence lifecycle to the column (dropped together)
ALTER SEQUENCE "Sale_saleNumber_seq" OWNED BY "Sale"."saleNumber";

-- CreateIndex
CREATE UNIQUE INDEX "Sale_saleNumber_key" ON "Sale"("saleNumber");
