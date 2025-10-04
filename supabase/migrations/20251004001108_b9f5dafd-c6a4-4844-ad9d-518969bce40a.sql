-- Add start_date and end_date columns to assignments table
ALTER TABLE public.assignments 
ADD COLUMN start_date date,
ADD COLUMN end_date date;

-- Migrate existing data: copy 'date' to both start_date and end_date
UPDATE public.assignments 
SET start_date = date, 
    end_date = date 
WHERE start_date IS NULL;

-- Make start_date required after migration
ALTER TABLE public.assignments 
ALTER COLUMN start_date SET NOT NULL;

-- Make end_date required after migration
ALTER TABLE public.assignments 
ALTER COLUMN end_date SET NOT NULL;

-- Add check to ensure end_date is not before start_date
ALTER TABLE public.assignments 
ADD CONSTRAINT check_date_range CHECK (end_date >= start_date);