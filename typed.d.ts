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
        };

        type Block = {
            code: number;
            bg: number;
            fg: number;
        };

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

        type UndoItem = {
            type: number;
            data: any;
        };

        type UndoCursor = {
            prev_x: number;
            prev_y: number;
            post_x: number;
            post_y: number;
        };

        type UndoBlockItem = Block & {
            x: number;
            y: number;
            cursor: UndoCursor;
        };

        type Font = {
            palette: Color[];
            name: string;
            height: number;
            bitmask: Uint8Array;
            width: number;
            length: number;
            use_9px_font: boolean;
            grayscale_mode: boolean;
            canvas: HTMLCanvasElement;
            glyphs: HTMLCanvasElement[];
            backgrounds: HTMLCanvasElement[];
            cursor: HTMLCanvasElement;
            load(options: {
                name?: string;
                bytes?: Uint8Array;
                use_9px_font?: boolean;
            }): Promise<void>;
            refresh_cache_at(index: number): void;
            draw(ctx: CanvasRenderingContext2D, block: Block, x: number, y: number): void;
            draw_raw(ctx: CanvasRenderingContext2D, block: Block, x: number, y: number): void;
            get_rgb(i: number): Color;
            draw_bg(ctx: CanvasRenderingContext2D, bg: number, x: number, y: number): void;
            draw_cursor(ctx: CanvasRenderingContext2D, x: number, y: number): void;
            get_glyphs_for(index: number): HTMLCanvasElement;
            get_background_for(index: number): HTMLCanvasElement;
        };

        type TextModeDataOptions = {
            columns?: number;
            rows?: number;
            title?: string;
            author?: string;
            group?: string;
            date?: string;
            palette?: Color[];
            font_name?: string;
            ice_colors?: boolean;
            use_9px_font?: boolean;
            comments?: string;
            data?: Block[];
            font_bytes?: Uint8Array;
        };

        type Brush = {
            size: number;
            custom_block_index: number;
            half_block_line(sx: number, sy: number, dx: number, dy: number, col: number, skip_first?: boolean): void;
            custom_block_line(sx: number, sy: number, dx: number, dy: number, fg: number, bg: number, skip_first?: boolean): void;
            shading_block_line(sx: number, sy: number, dx: number, dy: number, fg: number, bg: number, reduce: boolean, skip_first?: boolean): void;
            clear_block_line(sx: number, sy: number, dx: number, dy: number, skip_first?: boolean): void;
            replace_color_line(sx: number, sy: number, dx: number, dy: number, to: number, from: number, skip_first?: boolean): void;
            blink_line(sx: number, sy: number, dx: number, dy: number, unblink: boolean, skip_first?: boolean): void;
            colorize_line(sx: number, sy: number, dx: number, dy: number, fg?: number, bg?: number, skip_first?: boolean): void;
        };

        type HalfBlock = {
            x: number;
            y: number;
            text_y: number;
            is_blocky: boolean;
            is_vertically_blocky: boolean;
            upper_block_color: number;
            lower_block_color: number;
            left_block_color: number;
            right_block_color: number;
            is_top: boolean;
            fg: number;
            bg: number;
        };
    }

    interface HTMLElement {
        [key: string]: any;
    }
}

export {};
