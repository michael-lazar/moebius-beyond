declare global {
    namespace App {
        type Selection = {
            sx: number;
            sy: number;
            dx: number;
            dy: number;
        };

        type Blocks = {
            columns: number;
            rows: number;
            data: Block[];
            transparent?: boolean;
        };

        type Block = {
            code: number;
            bg: number;
            fg: number;
        };

        type Data = Block[];

        type Render = {
            columns: number;
            rows: number;
            width: number;
            height: number;
            ice_color_collection: HTMLCanvasElement[];
            blink_on_collection: HTMLCanvasElement[];
            blink_off_collection: HTMLCanvasElement[];
            preview_collection: HTMLCanvasElement[];
            maximum_rows: number;
            font: Font;
        };

        type Color = {
            r: number;
            g: number;
            b: number;
        };

        type Palette = Color[];

        type Font = {
            palette: Palette;
            name: string;
            height: number;
            bitmask: Uint8Array;
            width: number;
            length: number;
            use_9px_font: boolean;
            canvas: HTMLCanvasElement;
            glyphs: HTMLCanvasElement[];
            backgrounds: HTMLCanvasElement[];
            cursor: HTMLCanvasElement;
            load(options: {
                name?: string;
                bytes?: Uint8Array;
                use_9px_font?: boolean;
            }): Promise<void>;
            replace_cache_at(index: number, rgb: Color): void;
            draw(ctx: CanvasRenderingContext2D, block: Block, x: number, y: number): void;
            draw_raw(ctx: CanvasRenderingContext2D, block: Block, x: number, y: number): void;
            get_rgb(i: number): Color;
            draw_bg(ctx: CanvasRenderingContext2D, bg: number, x: number, y: number): void;
            draw_cursor(ctx: CanvasRenderingContext2D, x: number, y: number): void;
            get_glyphs_for(index: number): HTMLCanvasElement;
            get_background_for(index: number): HTMLCanvasElement;
        };
    }

    interface HTMLElement {
        [key: string]: any;
    }
}

export {};
